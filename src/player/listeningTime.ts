import type { Sentence } from '../extraction/types';
import { speakable } from '../tts/speakable';

/**
 * How much listening is left, which is what a reader actually wants to know.
 *
 * "412 of 5029" is precise and means nothing: nobody knows whether that is ten
 * minutes or an afternoon. This estimates from the text itself, because the
 * true duration of a sentence is only known once it has been synthesised, and
 * waiting for that would mean the number appears after it stops being useful.
 */

/**
 * Characters a voice gets through in a second at normal speed.
 *
 * Measured against synthesised output rather than assumed: English prose read
 * at a natural pace lands near 15 characters a second, which is about 165 words
 * a minute. It is an estimate and is presented as one -- rounded to minutes,
 * never to seconds.
 */
const CHARS_PER_SECOND = 15;

/** What is read aloud. Page furniture is displayed but never spoken. */
const isSpoken = (sentence: Sentence) =>
  sentence.kind !== 'header' && sentence.kind !== 'footer';

export function estimateSeconds(sentences: Sentence[], rate: number): number {
  const speed = Number.isFinite(rate) && rate > 0 ? rate : 1;

  let characters = 0;
  for (const sentence of sentences) {
    // The spoken form, not the printed one: what the engine is handed differs
    // from what is on the page, and it is the spoken length that takes time.
    if (isSpoken(sentence)) characters += speakable(sentence.text).length;
  }

  return characters / CHARS_PER_SECOND / speed;
}

/** "3h 20m", "45m", or nothing at all when there is nothing left. */
export function wordDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';

  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
