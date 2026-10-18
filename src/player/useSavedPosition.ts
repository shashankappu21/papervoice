import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { savePosition } from '../db/books';
import { createPositionKeeper, type PositionKeeper } from './positionKeeper';

/**
 * How often to write the position while reading. Often enough that a crash
 * costs a few seconds of listening, rarely enough that the disk is left alone.
 */
const INTERVAL_MS = 5000;

/**
 * Keeps a book's reading position on disk.
 *
 * Android ends an app by killing it, usually without warning and never with a
 * chance to tidy up, so the position cannot be written only on the way out. It
 * is written on a timer, whenever the app leaves the foreground, and when the
 * reader closes -- and only when it has actually moved, so a paused book does
 * not write the same number every five seconds.
 */
export function useSavedPosition(bookId: number | null, sentenceIndex: number): void {
  // One keeper for the life of the provider, remembering each book's place
  // separately (player/positionKeeper.ts). A single shared index is what let
  // the final save for a book being left pick up the next book's sentence.
  const keeper = useRef<PositionKeeper | null>(null);
  keeper.current ??= createPositionKeeper((id, index) => {
    // A book can be deleted between the timer firing and this landing, and
    // foreign keys are on, so the write would fail. Losing a position for a
    // book that no longer exists is not worth an unhandled rejection.
    void savePosition(id, index).catch(() => undefined);
  });
  const keep = keeper.current;

  if (bookId !== null) keep.seen(bookId, sentenceIndex);

  useEffect(() => {
    if (bookId === null) return;

    // A book just opened has not moved yet, and its stored position is the one
    // being resumed from: writing here would be writing it back to itself.
    keep.opened(bookId);

    const write = () => keep.flush(bookId);

    const timer = setInterval(write, INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      // 'inactive' is the moment before backgrounding on some devices, and is
      // the last certain chance to write.
      if (state !== 'active') write();
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
      // This book's own last place -- the keeper still has it, even though the
      // render that switched books has already moved on to the next one.
      write();
    };
  }, [bookId, keep]);
}
