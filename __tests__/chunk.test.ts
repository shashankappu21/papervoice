import { describe, it, expect } from 'vitest';
import { chunk } from '../src/tts/chunk';

const sentence = (words: number, word = 'word') =>
  Array.from({ length: words }, () => word).join(' ') + '.';

describe('chunk', () => {
  it('leaves a sentence of ordinary length alone', () => {
    expect(chunk('She had one hour left and no way to reach the building.', 300))
      .toEqual(['She had one hour left and no way to reach the building.']);
  });

  it('splits an overlong sentence at a clause boundary', () => {
    const text =
      'The first clause runs on for a while and says very little; ' +
      'the second clause carries the actual point of the sentence, ' +
      'and the third simply trails off at the end.';
    const pieces = chunk(text, 80);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.join(' ')).toBe(text);
    expect(pieces[0].endsWith(';')).toBe(true);
  });

  it('never splits inside a word', () => {
    const vocabulary = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];
    const text =
      Array.from({ length: 200 }, (_, i) => vocabulary[i % vocabulary.length]).join(' ') + '.';
    for (const piece of chunk(text, 100)) {
      for (const word of piece.split(' ')) {
        expect(vocabulary).toContain(word.replace(/\.$/, ''));
      }
      expect(piece.trim()).toBe(piece);
    }
  });

  it('breaks a clause that has no punctuation at all', () => {
    // An index entry is commaless page numbers; it still has to be broken up or
    // the synthesiser blocks the queue on one enormous utterance.
    const pieces = chunk(sentence(300), 100);
    expect(pieces.every((p) => p.length <= 100)).toBe(true);
  });

  it('loses no text', () => {
    const text = sentence(300);
    expect(chunk(text, 100).join(' ')).toBe(text);
  });

  it('prefers the last boundary that fits rather than the first', () => {
    const text = 'One, two, three, four, five, six, seven, eight, nine, ten.';
    const pieces = chunk(text, 30);
    expect(pieces[0].length).toBeGreaterThan(15);
    expect(pieces[0].length).toBeLessThanOrEqual(30);
  });
});
