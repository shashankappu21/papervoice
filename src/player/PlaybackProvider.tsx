import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getBook, listBooks, readSentences, touchBook, type Book } from '../db/books';
import { getSetting, setSetting, SETTING_LAST_BOOK, STAT_LISTENED, STAT_LISTENED_BY_VOICE } from '../db/settings';
import { buildSections } from '../extraction/sections';
import { nextChapterStart, sleepLabel, startMinutes, tick, type SleepTimer } from './sleepTimer';
import {
  add,
  addForVoice,
  dueForWrite,
  flush,
  flushVoices,
  voicesDueForWrite,
  type Counter,
  type VoiceCounter,
} from '../stats/listening';
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
  /** The sleep timer, or null when none is set. */
  sleep: SleepTimer | null;
  /** Minutes, the end of the chapter, or null to cancel. */
  setSleep(choice: { minutes: number } | 'chapter' | null): void;
  /** Whether the open book has chapters, so "End of chapter" can be offered. */
  hasChapters: boolean;
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
  /** The book now, for callbacks that must not change identity when it does. */
  const bookRef = useRef<Book | null>(null);
  bookRef.current = book;
  /** pause() changes identity every render; open() must not, or the reader re-opens in a loop. */
  const pauseRef = useRef<() => void>(() => undefined);
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
  const { pause, onPlayed, stopBefore, setVolume } = playback;
  pauseRef.current = pause;

  /*
   * The sleep timer.
   *
   * Held here, not in the reader, so it keeps counting from the mini player and
   * with the screen off. The exact seconds live in a ref, advanced by the
   * player's own progress reports; state changes only when what is shown
   * changes, so the whole tree is not redrawn twice a second for a countdown.
   */
  const [sleep, setSleepState] = useState<SleepTimer | null>(null);
  const sleepRef = useRef<SleepTimer | null>(null);

  const clearSleep = useCallback(() => {
    sleepRef.current = null;
    setSleepState(null);
    stopBefore(null);
    setVolume(1);
  }, [stopBefore, setVolume]);

  const sections = useMemo(
    () => buildSections(sentences, book?.outline),
    [sentences, book?.outline],
  );

  const setSleep = useCallback(
    (choice: { minutes: number } | 'chapter' | null) => {
      if (choice === null) {
        clearSleep();
        return;
      }
      setVolume(1);
      // A chapter edge left from an earlier choice must not outlive it.
      stopBefore(null);
      const next: SleepTimer =
        choice === 'chapter'
          ? { kind: 'chapter', stopBefore: nextChapterStart(sections, playback.currentIndex) }
          : startMinutes(choice.minutes);
      sleepRef.current = next;
      setSleepState(next);
    },
    [clearSleep, setVolume, stopBefore, sections, playback.currentIndex],
  );

  // A chapter timer follows the listener: jumping to another chapter moves the
  // edge it stops at. In the last chapter there is no edge, and the end of the
  // book -- or the listener pausing -- ends it.
  const chapterTimer = sleep?.kind === 'chapter';
  useEffect(() => {
    if (!chapterTimer) return;
    const edge = nextChapterStart(sections, playback.currentIndex);
    sleepRef.current = { kind: 'chapter', stopBefore: edge };
    stopBefore(edge, clearSleep);
  }, [chapterTimer, sections, playback.currentIndex, stopBefore, clearSleep]);

  const wasPlaying = useRef(false);
  useEffect(() => {
    const current = sleepRef.current;
    // Only on playing turning to stopped: setting the timer while paused must
    // not cancel it on the spot.
    if (wasPlaying.current && !playback.playing && current?.kind === 'chapter' && current.stopBefore === null) {
      clearSleep();
    }
    wasPlaying.current = playback.playing;
  }, [playback.playing, clearSleep]);

  // A minutes timer counts only what is played, and fades out at the end.
  useEffect(
    () =>
      onPlayed((seconds) => {
        const current = sleepRef.current;
        if (current?.kind !== 'minutes') return;
        const after = tick(current, seconds);
        sleepRef.current = after.timer;
        setVolume(after.volume);
        if (after.stop) {
          pause();
          clearSleep();
          return;
        }
        // Redrawn only when the shown minute changes.
        if (sleepLabel(after.timer) !== sleepLabel(current)) setSleepState(after.timer);
      }),
    [onPlayed, setVolume, pause, clearSleep],
  );

  // A timer belongs to a listening session; a different book starts without one.
  useEffect(() => clearSleep, [book?.id, clearSleep]);

  /*
   * How long has been listened to, in total. The questionnaire and the rating
   * prompt wait on it. Written every half minute and whenever playback stops,
   * rather than on every report.
   */
  const listened = useRef<Counter>({ stored: 0, pending: 0 });
  /** Nothing is written until the stored total is known, or it would be overwritten. */
  const listenedLoaded = useRef(false);
  useEffect(() => {
    getSetting(STAT_LISTENED)
      .then((stored) => {
        listened.current = { ...listened.current, stored: Number(stored) || 0 };
      })
      .catch(() => undefined)
      .finally(() => {
        listenedLoaded.current = true;
      });
  }, []);

  /** The same, split by the voice that was reading, for the voice report. */
  const byVoice = useRef<VoiceCounter>({ stored: {}, pending: {} });
  const byVoiceLoaded = useRef(false);
  useEffect(() => {
    getSetting(STAT_LISTENED_BY_VOICE)
      .then((stored) => {
        const parsed: unknown = stored ? JSON.parse(stored) : {};
        if (parsed && typeof parsed === 'object') {
          byVoice.current = { ...byVoice.current, stored: parsed as Record<string, number> };
        }
      })
      .catch(() => undefined)
      .finally(() => {
        byVoiceLoaded.current = true;
      });
  }, []);

  const writeListened = useCallback(() => {
    const counter = listened.current;
    if (!listenedLoaded.current || counter.pending <= 0) return;
    const written = flush(counter);
    listened.current = written.counter;
    void setSetting(STAT_LISTENED, String(written.total)).catch(() => undefined);

    if (!byVoiceLoaded.current || Object.keys(byVoice.current.pending).length === 0) return;
    const voices = flushVoices(byVoice.current);
    byVoice.current = voices.counter;
    void setSetting(STAT_LISTENED_BY_VOICE, JSON.stringify(voices.totals)).catch(() => undefined);
  }, []);

  useEffect(
    () =>
      onPlayed((seconds, voiceId) => {
        // Before the stored total has loaded, seconds wait in `pending`.
        const counter = add(listened.current, seconds);
        listened.current = counter;
        if (voiceId) byVoice.current = addForVoice(byVoice.current, voiceId, seconds);
        if (dueForWrite(counter) || voicesDueForWrite(byVoice.current)) writeListened();
      }),
    [onPlayed, writeListened],
  );

  useEffect(() => {
    if (!playback.playing) writeListened();
  }, [playback.playing, writeListened]);

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
      //
      // A different book stops the one playing first, at once. Left to the
      // player being rebuilt, the old book's sentence finished over the new
      // book's opening.
      if (bookRef.current && bookRef.current.id !== next.id) pauseRef.current();
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

  const hasChapters = sections.some((section) => section.depth === 0);

  const value = useMemo<PlaybackContextValue>(
    () => ({ playback, book, sentences, open, close, sleep, setSleep, hasChapters }),
    [playback, book, sentences, open, close, sleep, setSleep, hasChapters],
  );

  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}

export function useReading(): PlaybackContextValue {
  const found = useContext(PlaybackContext);
  if (!found) throw new Error('useReading was called outside PlaybackProvider.');
  return found;
}
