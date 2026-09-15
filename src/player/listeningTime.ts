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

/**
 * Cumulative spoken characters, so asking about a span costs a subtraction.
 *
 * `estimateSeconds` walks whatever it is handed, which is fine for a question
 * asked once. The reader asks twice a second -- how long so far, how long left
 * -- every time the spoken sentence changes, and it was handing over two fresh
 * slices of the whole book each time. Measured on a laptop that was 13ms per
 * sentence for a 5,000-sentence book and 158ms for an 80,000-sentence one, on
 * the thread that also draws the screen and answers the pause button. A phone
 * is several times slower again, which is what made a large PDF feel broken.
 *
 * Built once per book, it turns both questions into array lookups.
 *
 * Float64Array rather than number[]: one flat buffer of doubles instead of a
 * boxed array, which for 80,000 entries is the difference between a few
 * hundred kilobytes and several megabytes on a phone already holding the book.
 */
export function spokenLengths(sentences: Sentence[]): Float64Array {
  const running = new Float64Array(sentences.length + 1);
  for (let index = 0; index < sentences.length; index += 1) {
    const sentence = sentences[index];
    const length = isSpoken(sentence) ? speakable(sentence.text).length : 0;
    running[index + 1] = running[index] + length;
  }
  return running;
}

/**
 * Seconds of listening between two sentence indexes, from `spokenLengths`.
 *
 * Indexes are clamped rather than trusted. `currentIndex` can briefly sit past
 * the end as a book finishes, and a reader that threw there would take the
 * screen down at the moment the last sentence played.
 */
export function secondsBetween(
  running: Float64Array,
  from: number,
  to: number,
  rate: number,
): number {
  const speed = Number.isFinite(rate) && rate > 0 ? rate : 1;
  const last = running.length - 1;
  const clamp = (at: number) => Math.min(Math.max(Number.isFinite(at) ? at : 0, 0), last);
  const start = clamp(from);
  const end = clamp(to);
  if (end <= start) return 0;
  return (running[end] - running[start]) / CHARS_PER_SECOND / speed;
}
