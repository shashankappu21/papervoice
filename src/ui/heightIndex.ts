import type { Sentence } from '../extraction/types';

/**
 * Where every sentence is, measured rather than guessed.
 *
 * A FlatList can only jump to a row if it is told where the row is. Estimating
 * from text length gets close and no closer: the rows are laid out at their
 * real heights, so an estimated offset arrives near the sentence rather than
 * on it, and re-aiming with the same estimate arrives in the same wrong place.
 *
 * So every row reports its true height as it is laid out, and that is what is
 * kept. Rows not yet seen are still estimated -- there is no way to know the
 * height of text that has never been rendered -- but the estimate is
 * calibrated against the rows that have been, so it sharpens as a book is
 * read rather than staying wrong.
 */

const LINE_SPACING = 1.6;
const ROW_PADDING = 4;
const SIDE_PADDING = 40;

/** Starting guess at glyph width as a fraction of type size, before evidence. */
const GLYPH_WIDTH = 0.5;

/** Enough measurements to trust them over the opening guess. */
const ENOUGH_SAMPLES = 8;

export interface HeightIndex {
  /** Records a row's real height, as reported by its layout. */
  set(index: number, height: number): void;
  heightOf(index: number): number;
  offsetOf(index: number): number;
  total(): number;
}

export function createHeightIndex(
  sentences: Sentence[],
  fontSize: number,
  width: number,
): HeightIndex {
  const count = sentences.length;
  const measured: number[] = new Array(count).fill(0);
  const offsets: number[] = new Array(count).fill(0);
  let stale = true;

  const lineHeight = fontSize * LINE_SPACING;
  const usable = Math.max(1, width - SIDE_PADDING);

  /*
   * How many characters fit on a line, learned from what has been measured.
   *
   * Held as a running total rather than a single ratio so that one unusual
   * row -- a heading alone on its line, a fragment before a page break --
   * cannot pull the whole book's estimate with it.
   */
  let sampledChars = 0;
  let sampledLines = 0;

  const charsPerLine = (): number => {
    if (sampledLines >= ENOUGH_SAMPLES && sampledChars > 0) {
      return Math.max(1, sampledChars / sampledLines);
    }
    return Math.max(1, Math.floor(usable / (fontSize * GLYPH_WIDTH)));
  };

  const estimate = (index: number): number => {
    const text = sentences[index]?.text ?? '';
    const lines = Math.max(1, Math.ceil(text.length / charsPerLine()));
    return lines * lineHeight + ROW_PADDING;
  };

  const heightOf = (index: number): number => {
    if (index < 0 || index >= count) return lineHeight + ROW_PADDING;
    return measured[index] > 0 ? measured[index] : estimate(index);
  };

  const rebuild = (): void => {
    let running = 0;
    for (let i = 0; i < count; i++) {
      offsets[i] = running;
      running += heightOf(i);
    }
    stale = false;
  };

  return {
    set(index, height) {
      // A row cannot be nothing tall, and accepting one would collapse the
      // offsets of everything below it.
      if (index < 0 || index >= count) return;
      if (!Number.isFinite(height) || height <= 0) return;
      // Sub-pixel differences on a re-render are not news. Taking them would
      // mark the offsets dirty and move the page for nothing.
      if (measured[index] > 0 && Math.abs(measured[index] - height) < 0.5) return;

      const text = sentences[index]?.text ?? '';
      if (measured[index] === 0 && text.length > 0) {
        // Only the first measurement of a row teaches anything; re-measuring
        // the same row on a re-render would count it twice.
        const lines = Math.max(1, Math.round((height - ROW_PADDING) / lineHeight));
        sampledChars += text.length;
        sampledLines += lines;
      }

      measured[index] = height;
      stale = true;
    },

    heightOf,

    offsetOf(index) {
      if (index <= 0) return 0;
      if (index >= count) return this.total();
      if (stale) rebuild();
      return offsets[index];
    },

    total() {
      if (stale) rebuild();
      return count === 0 ? 0 : offsets[count - 1] + heightOf(count - 1);
    },
  };
}
