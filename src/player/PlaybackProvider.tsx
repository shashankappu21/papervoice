import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getBook, listBooks, readSentences, touchBook, type Book } from '../db/books';
import { getSetting, setSetting, SETTING_LAST_BOOK } from '../db/settings';
import type { Sentence } from '../extraction/types';
import { usePlayback, type Playback } from './usePlayback';
import { useSavedPosition } from './useSavedPosition';
import { bookToRestore } from './restore';
import { resumeIndex } from '../library/progress';

const NO_SENTENCES: Sentence[] = [];

interface PlaybackContextValue {
  playback: Playback;
  /** The book being read, or null before anything has been opened. */
  book: Book | null;
  sentences: Sentence[];
  open(book: Book): void;
  /** Stops and forgets the book, so the mini player goes away. */
  close(): void;
}

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

/**
 * The reading, held above the screens rather than inside one.
 *
 * It used to live in the reader, which meant leaving the reader tore the
 * engine down mid-sentence. Holding it here is what lets someone walk back to
 * the library, or over to the voices, while a book keeps being read to them --
 * and it is what the bar above the tabs is showing.
 */
export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const [book, setBook] = useState<Book | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>(NO_SENTENCES);
  /**
   * Whether the voice should load before play is pressed. Set when someone
   * opens a book; left false for the one restored at launch, so a cold start
   * does not load a voice model for a book that may not be played.
   */
  const [preload, setPreload] = useState(false);

  const playback = usePlayback(
    sentences,
    book?.title ?? '',
    // A finished book opens at the start, not on its last sentence.
    book ? resumeIndex(book) : 0,
    book?.id ?? 0,
    preload,
  );
  const { pause } = playback;

  /*
   * Cold start: put the last book back on the bar, paused, voice not loaded.
   *
   * Not touchBook(): this is the app remembering, not someone opening it, and
   * counting it as opened would reorder the library on every launch.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await getSetting(SETTING_LAST_BOOK);
      // Only an install that has never written the setting needs the library.
      const recent = stored === null ? ((await listBooks())[0] ?? null) : null;
      const id = bookToRestore(stored, recent);
      if (id === null) return;

      const found = await getBook(id);
      if (cancelled || !found) return;

      setBook((current) => {
        // Something was opened while this was looking -- a shared PDF, or a
        // tap in the library. That wins: it is what someone asked for.
        if (current) return current;
        setSentences(readSentences(found));
        return found;
      });
    })().catch((cause: unknown) => {
      // Nothing on the bar is the right fallback; reading still works.
      console.log('[papervoice] could not restore the last book:', String(cause));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Saved here rather than in the reader. A book can be listened to entirely
  // from the bar above the tabs, and the reader being closed is no reason for
  // the place to stop being recorded.
  useSavedPosition(book?.id ?? null, playback.currentIndex);

  const open = useCallback(
    (next: Book) => {
      // Opening is intent to listen, so the voice may start loading now --
      // including for a book that was restored at launch and is only now
      // being opened.
      setPreload(true);
      // Re-opening the book already loaded would reset the place to whatever
      // was saved, which is behind where it has since been read to.
      setBook((current) => {
        if (current?.id === next.id) return current;
        setSentences(readSentences(next));
        void touchBook(next.id);
        return next;
      });
      void setSetting(SETTING_LAST_BOOK, String(next.id)).catch(() => undefined);
    },
    [],
  );

  const close = useCallback(() => {
    pause();
    setBook(null);
    setSentences(NO_SENTENCES);
    setPreload(false);
    // Closed on purpose, so it stays closed across a restart.
    void setSetting(SETTING_LAST_BOOK, '').catch(() => undefined);
  }, [pause]);

  const value = useMemo<PlaybackContextValue>(
    () => ({ playback, book, sentences, open, close }),
    [playback, book, sentences, open, close],
  );

  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}

export function useReading(): PlaybackContextValue {
  const found = useContext(PlaybackContext);
  if (!found) throw new Error('useReading was called outside PlaybackProvider.');
  return found;
}
