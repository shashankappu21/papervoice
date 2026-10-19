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

/**
 * The same listening, split by the voice that was reading.
 *
 * Kept beside the total rather than replacing it: the total predates this and
 * already decides when the questionnaire appears. This one exists for the voice
 * report -- which voices people stay with -- and counts only from the build that
 * introduced it. Keys are the ids a voice is saved by: a catalog id, or
 * `system:` and the phone engine's own.
 */
export interface VoiceCounter {
  stored: Record<string, number>;
  pending: Record<string, number>;
}

export function addForVoice(counter: VoiceCounter, voiceId: string, seconds: number): VoiceCounter {
  if (!(seconds > 0)) return counter;
  return {
    ...counter,
    pending: { ...counter.pending, [voiceId]: (counter.pending[voiceId] ?? 0) + seconds },
  };
}

export function voicesDueForWrite(counter: VoiceCounter): boolean {
  return Object.values(counter.pending).reduce((sum, seconds) => sum + seconds, 0) >= FLUSH_EVERY_SEC;
}

/** The counter once its pending seconds are written, and the totals to write. */
export function flushVoices(counter: VoiceCounter): { counter: VoiceCounter; totals: Record<string, number> } {
  const totals = { ...counter.stored };
  for (const [voiceId, seconds] of Object.entries(counter.pending)) {
    totals[voiceId] = Math.round((totals[voiceId] ?? 0) + seconds);
  }
  return { counter: { stored: totals, pending: {} }, totals };
}

/** The voices listened to most, most first; equal times in id order, so it is stable. */
export function topVoices(totals: Record<string, number>, n: number): Array<{ id: string; seconds: number }> {
  return Object.entries(totals)
    .filter(([, seconds]) => seconds > 0)
    .map(([id, seconds]) => ({ id, seconds }))
    .sort((a, b) => b.seconds - a.seconds || a.id.localeCompare(b.id))
    .slice(0, n);
}

/** How many voices have been listened to at all. */
export const voicesTried = (totals: Record<string, number>): number =>
  Object.values(totals).filter((seconds) => seconds > 0).length;

export const listenedAcrossVoices = (totals: Record<string, number>): number =>
  Object.values(totals).reduce((sum, seconds) => sum + Math.max(0, seconds), 0);
