import { describe, it, expect } from 'vitest';
import { speakable } from '../src/tts/speakable';

describe('speakable', () => {
  it('moves a currency symbol after the amount it belongs to', () => {
    // Written "$1.5 million", a synthesiser reads the symbol where it stands:
    // "dollar one point five million".
    expect(speakable('convince investors to invest $1.5 million in your software'))
      .toBe('convince investors to invest 1.5 million dollars in your software');
  });

  it('keeps the currency singular for exactly one', () => {
    expect(speakable('It cost $1 to enter.')).toBe('It cost 1 dollar to enter.');
  });

  it('handles the other symbols a book is likely to use', () => {
    expect(speakable('£20')).toBe('20 pounds');
    expect(speakable('€3.2 billion')).toBe('3.2 billion euros');
    expect(speakable('₹500')).toBe('500 rupees');
  });

  it('reads a percentage as a word', () => {
    expect(speakable('down 40% this year')).toBe('down 40 percent this year');
  });

  it('reads an ampersand as "and"', () => {
    expect(speakable('Johnson & Johnson')).toBe('Johnson and Johnson');
  });

  it('expands the Latin abbreviations that would be spelled out', () => {
    expect(speakable('fruit, e.g. apples')).toBe('fruit, for example apples');
    expect(speakable('the deadline, i.e. Friday')).toBe('the deadline, that is Friday');
    expect(speakable('apples, oranges, etc.')).toBe('apples, oranges, et cetera.');
  });

  it('expands a title so it is not spelled out', () => {
    expect(speakable('Dr. Manette returned home.')).toBe('Doctor Manette returned home.');
  });

  it('reads a dashed number range as a range', () => {
    expect(speakable('between 2019–2021 the market moved'))
      .toBe('between 2019 to 2021 the market moved');
  });

  it('leaves a dashed pair alone when it cannot be a range', () => {
    // "House Document 110-50" is a number, not a span of numbers, and reading it
    // as "110 to 50" is nonsense. A range runs upwards.
    expect(speakable('1st Session No. 110–50')).toBe('1st Session No. 110–50');
  });

  it('leaves an em dash alone, because it is a pause and not a range', () => {
    expect(speakable('She paused — and then left.')).toBe('She paused — and then left.');
  });

  it('leaves ordinary prose exactly as it was', () => {
    const text = 'A single misinterpreted tweet can spread like wildfire.';
    expect(speakable(text)).toBe(text);
  });
});
