/**
 * How long someone has actually listened, in total.
 *
 * Counted from the player reporting that it is playing -- not from the app
 * being open, not from a book being on screen -- so pausing to talk, or
 * waiting on synthesis, adds nothing. The questionnaire and the rating prompt
 * wait for real listening before asking anything, and 1.2's daily goal will
 * build on the same count.
 *
 * Pure: the caller decides when to read and write the stored total.
 */

/** Gaps longer than this between two reports are not counted as listening. */
export const LONGEST_GAP_SEC = 2;

/** Writing to the database on every report would be several writes a second. */
export const FLUSH_EVERY_SEC = 30;

export interface Counter {
  /** Seconds already stored. */
  stored: number;
  /** Seconds counted since the last write. */
  pending: number;
}

/**
 * The seconds between two playing reports, or zero when they are too far
 * apart to be one stretch of listening -- the phone slept, or a report was
 * lost -- rather than counting the gap as time listened.
 */
export function playedBetween(previousAt: number | null, now: number): number {
  if (previousAt === null) return 0;
  const seconds = (now - previousAt) / 1000;
  return seconds > 0 && seconds <= LONGEST_GAP_SEC ? seconds : 0;
}

export function add(counter: Counter, seconds: number): Counter {
  return { ...counter, pending: counter.pending + Math.max(0, seconds) };
}

export function dueForWrite(counter: Counter): boolean {
  return counter.pending >= FLUSH_EVERY_SEC;
}

/** The counter once its pending seconds are written, and the total to write. */
export function flush(counter: Counter): { counter: Counter; total: number } {
  const total = Math.round(counter.stored + counter.pending);
  return { counter: { stored: total, pending: 0 }, total };
}

export const total = (counter: Counter): number => counter.stored + counter.pending;
