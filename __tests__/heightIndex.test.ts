import { describe, expect, it } from 'vitest';
import { createHeightIndex } from '../src/ui/heightIndex';
import type { Sentence } from '../src/extraction/types';

const say = (index: number, text: string): Sentence => ({
  index,
  kind: 'body',
  text,
  boxes: [],
});

const book = (count: number, length = 100) =>
  Array.from({ length: count }, (_, i) => say(i, 'x'.repeat(length)));

describe('what has been measured', () => {
  it('returns the measured height, not an estimate', () => {
    const index = createHeightIndex(book(5), 18, 360);
    index.set(2, 137);
    expect(index.heightOf(2)).toBe(137);
  });

  it('puts a measured row exactly where the rows above it end', () => {
    const index = createHeightIndex(book(4), 18, 360);
    index.set(0, 50);
    index.set(1, 30);
    index.set(2, 70);
    expect(index.offsetOf(0)).toBe(0);
    expect(index.offsetOf(1)).toBe(50);
    expect(index.offsetOf(2)).toBe(80);
    expect(index.offsetOf(3)).toBe(150);
  });

  it('moves everything below when a row is measured', () => {
    const index = createHeightIndex(book(3), 18, 360);
    const before = index.offsetOf(2);
    index.set(0, index.heightOf(0) + 100);
    expect(index.offsetOf(2)).toBe(before + 100);
  });

  it('ignores a nonsense measurement', () => {
    const index = createHeightIndex(book(3), 18, 360);
    const estimate = index.heightOf(1);
    index.set(1, 0);
    index.set(1, Number.NaN);
    index.set(1, -20);
    // A row cannot be nothing tall, and accepting one would collapse the
    // offsets of everything below it.
    expect(index.heightOf(1)).toBe(estimate);
  });
});

describe('what has not been measured yet', () => {
  it('estimates from the text, the type size and the width', () => {
    const index = createHeightIndex(book(3, 400), 18, 360);
    const narrow = createHeightIndex(book(3, 400), 18, 200);
    expect(narrow.heightOf(0)).toBeGreaterThan(index.heightOf(0));
  });

  it('learns the real shape of the text from the rows it has seen', () => {
    const index = createHeightIndex(book(200, 100), 18, 360);

    // Every measured row is twice what was guessed, so the rows still unseen
    // should be expected to be about twice as tall too.
    const guessed = index.heightOf(150);
    for (let i = 0; i < 20; i++) index.set(i, index.heightOf(i) * 2);

    const learned = index.heightOf(150);
    expect(learned).toBeGreaterThan(guessed * 1.5);
  });

  it('does not let one strange row rewrite everything', () => {
    const index = createHeightIndex(book(200, 100), 18, 360);
    const guessed = index.heightOf(150);
    // A heading on its own line is short; it must not make the whole book short.
    index.set(0, 4);
    expect(index.heightOf(150)).toBeGreaterThan(guessed / 2);
  });
});

describe('holding up over a whole book', () => {
  const index = createHeightIndex(book(5000), 18, 360);

  it('answers for the last row without walking there', () => {
    expect(Number.isFinite(index.offsetOf(4999))).toBe(true);
    expect(index.offsetOf(4999)).toBeGreaterThan(0);
  });

  it('keeps offsets in order', () => {
    expect(index.offsetOf(4000)).toBeGreaterThan(index.offsetOf(3999));
  });

  it('answers safely outside the book', () => {
    expect(index.heightOf(-1)).toBeGreaterThan(0);
    expect(index.heightOf(99999)).toBeGreaterThan(0);
    expect(index.offsetOf(-1)).toBe(0);
    expect(Number.isFinite(index.offsetOf(99999))).toBe(true);
  });
});
