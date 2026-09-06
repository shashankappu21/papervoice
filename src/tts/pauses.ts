import type { Sentence } from '../extraction/types';

/**
 * How long to stay silent after an utterance.
 *
 * The playlist plays gaplessly, which is right for the pieces of one sentence
 * and wrong between sentences: run together, they are exhausting to follow. The
 * pause is written into the audio rather than left to the player, so it holds
 * however the tracks are scheduled.
 */
export interface Utterance {
  kind: Sentence['kind'];
  /** False for a piece of a longer sentence, cut at a clause boundary. */
  endsSentence: boolean;
  /**
   * How comfortably synthesis is keeping ahead of playback: the real-time
   * factor recently measured on this device. Omitted at the start of a run,
   * when nothing has been measured yet.
   */
  rtf?: number;
}

/** Above this, synthesis is no longer far enough ahead to spend time on a pause. */
const STRAINED = 0.6;

/** At this point the listener is already waiting between utterances. */
const OVERRUN = 0.9;

export function pauseAfter({ kind, endsSentence, rtf }: Utterance): number {
  const full = baseline(kind, endsSentence);

  // A pause costs nothing to generate, but it is not free to the listener. When
  // the engine is barely outrunning playback they are already hearing a gap
  // while the next utterance is made, and a designed pause only lengthens it.
  if (rtf === undefined || rtf < STRAINED) return full;
  if (rtf >= OVERRUN) return 0;

  return Math.round((full * (OVERRUN - rtf)) / (OVERRUN - STRAINED));
}

function baseline(kind: Sentence['kind'], endsSentence: boolean): number {
  // Mid-sentence: just the breath a clause boundary already implies. Any more
  // and the listener hears the seam where the sentence was cut for synthesis.
  if (!endsSentence) return 90;

  // A chapter title wants room before the prose starts.
  if (kind === 'heading') return 700;

  return 280;
}
