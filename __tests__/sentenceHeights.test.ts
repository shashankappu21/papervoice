import { describe, expect, it } from 'vitest';
import { estimateHeight, measureSentences } from '../src/ui/sentenceHeights';
import type { Sentence } from '../src/extraction/types';

const say = (index: number, text: string): Sentence => ({
  index,
  kind: 'body',
  text,
  boxes: [],
});

const WIDTH = 360;

describe('estimateHeight', () => {
  it('gives a short sentence one line', () => {
    const line = estimateHeight('Hi.', 18, WIDTH);
    const two = estimateHeight('x'.repeat(200), 18, WIDTH);
    expect(two).toBeGreaterThan(line);
  });

  it('grows with the text', () => {
    const short = estimateHeight('x'.repeat(40), 18, WIDTH);
    const long = estimateHeight('x'.repeat(400), 18, WIDTH);
    expect(long).toBeGreaterThan(short);
  });

  it('grows with the type size', () => {
    const small = estimateHeight('x'.repeat(200), 14, WIDTH);
    const large = estimateHeight('x'.repeat(200), 28, WIDTH);
    expect(large).toBeGreaterThan(small);
  });

  it('grows as the column narrows', () => {
    const wide = estimateHeight('x'.repeat(200), 18, 600);
    const narrow = estimateHeight('x'.repeat(200), 18, 200);
    expect(narrow).toBeGreaterThan(wide);
  });

  it('never returns nothing, whatever it is given', () => {
    expect(estimateHeight('', 18, WIDTH)).toBeGreaterThan(0);
    // A width of zero happens on the first render, before layout.
    expect(estimateHeight('Some text.', 18, 0)).toBeGreaterThan(0);
    expect(Number.isFinite(estimateHeight('Some text.', 18, WIDTH))).toBe(true);
  });
});

describe('measureSentences', () => {
  const book = [say(0, 'One.'), say(1, 'x'.repeat(300)), say(2, 'Three.')];

  it('offsets each row by everything above it', () => {
    const { heights, offsets } = measureSentences(book, 18, WIDTH);
    expect(offsets[0]).toBe(0);
    expect(offsets[1]).toBe(heights[0]);
    expect(offsets[2]).toBe(heights[0] + heights[1]);
  });

  it('measures every row', () => {
    const { heights, offsets } = measureSentences(book, 18, WIDTH);
    expect(heights).toHaveLength(book.length);
    expect(offsets).toHaveLength(book.length);
  });

  it('handles an empty book', () => {
    const { heights, offsets } = measureSentences([], 18, WIDTH);
    expect(heights).toEqual([]);
    expect(offsets).toEqual([]);
  });

  it('stays finite across a long book', () => {
    // The whole point is jumping to sentence 5,000 without walking there, so
    // the arithmetic has to hold up over that distance.
    const long = Array.from({ length: 5000 }, (_, i) => say(i, 'A sentence of prose.'));
    const { offsets } = measureSentences(long, 18, WIDTH);
    expect(Number.isFinite(offsets[4999])).toBe(true);
    expect(offsets[4999]).toBeGreaterThan(offsets[0]);
  });
});
