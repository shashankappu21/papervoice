import type { Section } from '../extraction/sections';

/**
 * The sleep timer, as plain arithmetic.
 *
 * Kept apart from playback so the rules -- count only while playing, fade at
 * the end, stop at a chapter's edge -- can be tested without a player. The
 * provider feeds it the seconds actually played and does what it says.
 */

/** What the listener can choose, in minutes. */
export const SLEEP_MINUTES = [15, 30, 45, 60] as const;

/** How long the voice takes to fade away before pausing. */
export const FADE_SECONDS = 10;

export type SleepTimer =
  /** Seconds of playing left. Pausing stops the count. */
  | { kind: 'minutes'; leftSec: number }
  /**
   * Stop before this sentence: the first of the next chapter. Null when the
   * reader is in the last chapter, where the end of the book is the stop.
   */
  | { kind: 'chapter'; stopBefore: number | null };

export function startMinutes(minutes: number): SleepTimer {
  return { kind: 'minutes', leftSec: minutes * 60 };
}

/** The first sentence of the chapter after the one being read, if any. */
export function nextChapterStart(sections: Section[], currentIndex: number): number | null {
  // Only top-level entries: a sub-section inside a chapter is not where
  // someone falling asleep expects the reading to stop.
  for (const section of sections) {
    if (section.depth === 0 && section.index > currentIndex) return section.index;
  }
  return null;
}

export function startChapter(sections: Section[], currentIndex: number): SleepTimer {
  return { kind: 'chapter', stopBefore: nextChapterStart(sections, currentIndex) };
}

export interface Tick {
  /** The timer after this tick, or null once it has fired. */
  timer: SleepTimer | null;
  /** The volume to play at: 1 normally, falling to 0 over the fade. */
  volume: number;
  /** True when playback should pause now. */
  stop: boolean;
}

/**
 * Advances a minutes timer by the seconds just played.
 *
 * A chapter timer is not advanced here: it fires on a sentence boundary,
 * which playback reports, not on time.
 */
export function tick(timer: SleepTimer | null, playedSec: number): Tick {
  if (!timer || timer.kind !== 'minutes') return { timer, volume: 1, stop: false };

  const leftSec = Math.max(0, timer.leftSec - Math.max(0, playedSec));
  if (leftSec <= 0) return { timer: null, volume: 0, stop: true };

  const volume = leftSec < FADE_SECONDS ? leftSec / FADE_SECONDS : 1;
  return { timer: { kind: 'minutes', leftSec }, volume, stop: false };
}

/** How the timer reads on screen: "23 min", "1 min", "End of chapter". */
export function sleepLabel(timer: SleepTimer | null): string | null {
  if (!timer) return null;
  if (timer.kind === 'chapter') return 'End of chapter';
  // Rounded up, so "0 min" is never shown while it is still playing.
  return `${Math.max(1, Math.ceil(timer.leftSec / 60))} min`;
}
