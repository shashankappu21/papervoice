import { describe, expect, it } from 'vitest';
import {
  estimateSeconds,
  secondsBetween,
  spokenLengths,
  wordDuration,
} from '../src/player/listeningTime';
import type { Sentence } from '../src/extraction/types';

const say = (text: string, kind: Sentence['kind'] = 'body'): Sentence => ({
  index: 0,
  kind,
  text,
  boxes: [],
});

describe('estimateSeconds', () => {
  it('grows with the amount of text', () => {
    const short = estimateSeconds([say('Hello.')], 1);
    const long = estimateSeconds([say('Hello there, this is a longer sentence.')], 1);
    expect(long).toBeGreaterThan(short);
  });

  it('halves when the rate doubles', () => {
    const once = estimateSeconds([say('A sentence of some length here.')], 1);
    const twice = estimateSeconds([say('A sentence of some length here.')], 2);
    expect(twice).toBeCloseTo(once / 2, 5);
  });

  it('counts nothing for an empty book', () => {
    expect(estimateSeconds([], 1)).toBe(0);
  });

  it('ignores what is never spoken', () => {
    // Headers and footers are on the page but not read, so they cannot count
    // towards how long there is left to listen.
    const spoken = estimateSeconds([say('Real prose that gets read aloud.')], 1);
    const withFurniture = estimateSeconds(
      [say('Real prose that gets read aloud.'), say('CHAPTER 4', 'header'), say('72', 'footer')],
      1,
    );
    expect(withFurniture).toBe(spoken);
  });

  it('treats a nonsense rate as normal speed', () => {
    const normal = estimateSeconds([say('Some words here.')], 1);
    expect(estimateSeconds([say('Some words here.')], 0)).toBe(normal);
    expect(estimateSeconds([say('Some words here.')], Number.NaN)).toBe(normal);
  });
});

describe('wordDuration', () => {
  it('says nothing at all when there is nothing left', () => {
    expect(wordDuration(0)).toBe('');
    expect(wordDuration(-5)).toBe('');
  });

  it('counts in minutes below an hour', () => {
    expect(wordDuration(90)).toBe('2m');
    expect(wordDuration(59 * 60)).toBe('59m');
  });

  it('counts in hours and minutes above one', () => {
    expect(wordDuration(3 * 3600 + 20 * 60)).toBe('3h 20m');
    expect(wordDuration(3600)).toBe('1h');
  });

  it('never says zero minutes', () => {
    // A few seconds left is still "1m": "0m" reads as finished when it is not.
    expect(wordDuration(4)).toBe('1m');
  });
});

describe('spokenLengths and secondsBetween', () => {
  const book = [say('One sentence here.'), say('Another one, slightly longer.'), say('Third.')];

  it('agrees with walking the sentences', () => {
    // The point of the running total is to be the same answer, faster. If the
    // two ever disagree the estimate has quietly changed for every reader.
    const running = spokenLengths(book);
    for (let at = 0; at <= book.length; at += 1) {
      expect(secondsBetween(running, 0, at, 1)).toBeCloseTo(estimateSeconds(book.slice(0, at), 1));
      expect(secondsBetween(running, at, book.length, 1)).toBeCloseTo(
        estimateSeconds(book.slice(at), 1),
      );
    }
  });

  it('skips page furniture, as the walk does', () => {
    const withFurniture = [say('Real prose.'), { text: 'Page 12', kind: 'footer' as const }];
    const running = spokenLengths(withFurniture as never);
    expect(secondsBetween(running, 0, 2, 1)).toBeCloseTo(estimateSeconds([say('Real prose.')], 1));
  });

  it('is scaled by the speed', () => {
    const running = spokenLengths(book);
    expect(secondsBetween(running, 0, book.length, 2)).toBeCloseTo(
      secondsBetween(running, 0, book.length, 1) / 2,
    );
  });

  it('survives an index past the end', () => {
    /*
     * currentIndex briefly sits past the last sentence as a book finishes.
     * Throwing there would take the reader down on the final sentence.
     */
    const running = spokenLengths(book);
    expect(secondsBetween(running, 0, 999, 1)).toBeCloseTo(
      secondsBetween(running, 0, book.length, 1),
    );
    expect(secondsBetween(running, 999, 1000, 1)).toBe(0);
    expect(secondsBetween(running, -5, 1, 1)).toBeGreaterThan(0);
  });

  it('returns nothing for a backwards span', () => {
    expect(secondsBetween(spokenLengths(book), 2, 1, 1)).toBe(0);
  });

  it('handles an empty book', () => {
    expect(secondsBetween(spokenLengths([]), 0, 0, 1)).toBe(0);
  });
});
