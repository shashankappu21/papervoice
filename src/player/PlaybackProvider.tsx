import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { readSentences, touchBook, type Book } from '../db/books';
import type { Sentence } from '../extraction/types';
import { usePlayback, type Playback } from './usePlayback';

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

  const playback = usePlayback(sentences, book?.title ?? '', book?.position ?? 0);
  const { pause } = playback;

  const open = useCallback(
    (next: Book) => {
      // Re-opening the book already loaded would reset the place to whatever
      // was saved, which is behind where it has since been read to.
      setBook((current) => {
        if (current?.id === next.id) return current;
        setSentences(readSentences(next));
        void touchBook(next.id);
        return next;
      });
    },
    [],
  );

  const close = useCallback(() => {
    pause();
    setBook(null);
    setSentences(NO_SENTENCES);
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
