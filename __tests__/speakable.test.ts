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

  it('reads a written currency abbreviation after its amount too', () => {
    expect(speakable('a deposit of Rs. 14,000 was collected'))
      .toBe('a deposit of 14,000 rupees was collected');
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

  it('turns an em dash into a pause the engine can hear', () => {
    // espeak-ng ignores the dash character outright, so the break a writer put
    // there is lost and the sentence runs straight on. A comma is the nearest
    // mark it does pause for, and it does not reset the intonation the way a
    // full stop would.
    expect(speakable('She paused — and then left.')).toBe('She paused, and then left.');
  });

  it('handles an em dash set tight against its words', () => {
    // The quotes go too, which is tested on its own; what matters here is that
    // the dash between them becomes a pause rather than nothing.
    expect(speakable('BEWARE "YES"—MASTER "NO"')).toBe('BEWARE YES, MASTER NO');
  });

  it('does not turn a hyphenated word into a pause', () => {
    expect(speakable('a real-time tweet evaluator')).toBe('a real-time tweet evaluator');
  });

  it('does not hand quotation marks to the engine', () => {
    // A reader conveys speech marks with their voice, never by saying them.
    // Given the characters, the engine makes a sound for them.
    expect(speakable('“We’ve got your son, Voss.”')).toBe(
      'We’ve got your son, Voss.',
    );
    expect(speakable('He said "stop" twice.')).toBe('He said stop twice.');
  });

  it('keeps the apostrophes inside words', () => {
    // The same characters that quote also contract, and losing these would
    // turn "don't" into "dont".
    expect(speakable("don't, it's, O'Brien")).toBe("don't, it's, O'Brien");
    expect(speakable('the ’90s and Jane’s book')).toBe('the ’90s and Jane’s book');
  });

  it('reads an exclamation as a firm full stop', () => {
    // Kitten delivers an exclamation as alarm, which is exhausting over a book.
    // The sentence still ends; it simply is not shouted.
    expect(speakable('Stop right there!')).toBe('Stop right there.');
  });

  it('leaves ordinary prose exactly as it was', () => {
    const text = 'A single misinterpreted tweet can spread like wildfire.';
    expect(speakable(text)).toBe(text);
  });
});
