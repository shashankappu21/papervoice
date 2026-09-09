import type { Sentence } from '../extraction/types';

/**
 * How tall each sentence will be, worked out rather than measured.
 *
 * A FlatList that cannot say where a row is has to render its way there. For a
 * five-thousand-sentence book that means building thousands of rows to reach
 * one of them, which is why opening a book at the place it was left, or
 * jumping to a chapter, took as long as it did.
 *
 * These are estimates. They are wrong by a few pixels a row and that is fine:
 * they get the list to the right screen immediately, and the reader corrects
 * itself precisely once the target has actually been rendered.
 */

/** Matches the lineHeight the list renders with. */
const LINE_SPACING = 1.6;

/** Padding above and below a row, from the list's own styles. */
const ROW_PADDING = 4;

/** Left and right padding, which the text does not get to use. */
const SIDE_PADDING = 40;

/**
 * Average glyph width as a fraction of the type size.
 *
 * English prose in a proportional face runs close to half the point size per
 * character. Being a little generous is safer than being tight: guessing too
 * few lines lands the reader short of the sentence, which is more confusing
 * than landing slightly beyond it.
 */
const GLYPH_WIDTH = 0.5;

export function estimateHeight(text: string, fontSize: number, width: number): number {
  const lineHeight = fontSize * LINE_SPACING;
  const usable = Math.max(1, width - SIDE_PADDING);
  const perLine = Math.max(1, Math.floor(usable / (fontSize * GLYPH_WIDTH)));
  const lines = Math.max(1, Math.ceil(text.length / perLine));
  return lines * lineHeight + ROW_PADDING;
}

export interface Measured {
  heights: number[];
  /** Where each row starts, being everything above it added up. */
  offsets: number[];
}

export function measureSentences(
  sentences: Sentence[],
  fontSize: number,
  width: number,
): Measured {
  const heights: number[] = new Array(sentences.length);
  const offsets: number[] = new Array(sentences.length);

  let running = 0;
  for (let i = 0; i < sentences.length; i++) {
    offsets[i] = running;
    heights[i] = estimateHeight(sentences[i].text, fontSize, width);
    running += heights[i];
  }

  return { heights, offsets };
}
