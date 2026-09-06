import { describe, it, expect } from 'vitest';
import { buildSentences } from '../src/extraction/sentences';
import type { TextItem } from '../src/extraction/types';

const item = (text: string, o: Partial<TextItem> = {}): TextItem => ({
  text,
  page: 1,
  x: 50,
  y: 700,
  width: 100,
  height: 12,
  fontSize: 12,
  ...o,
});

describe('buildSentences', () => {
  it('splits a line into sentences on terminal punctuation', () => {
    const out = buildSentences([item('Hello there. How are you?')], 792);
    expect(out.map((s) => s.text)).toEqual(['Hello there.', 'How are you?']);
    expect(out[0].index).toBe(0);
    expect(out[1].index).toBe(1);
  });

  it('joins items on the same line into one sentence', () => {
    const out = buildSentences(
      [
        item('The count had ', { x: 50, width: 60 }),
        item('not yet spoken.', { x: 110, width: 70 }),
      ],
      792,
    );
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('The count had not yet spoken.');
  });

  it('joins a sentence that wraps across two lines and keeps both boxes', () => {
    const out = buildSentences(
      [item('The count had not', { y: 700 }), item('yet spoken.', { y: 686 })],
      792,
    );
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('The count had not yet spoken.');
    expect(out[0].boxes).toHaveLength(2);
  });

  it('repairs a hyphen broken across lines', () => {
    const out = buildSentences(
      [item('extraor-', { y: 700 }), item('dinary events.', { y: 686 })],
      792,
    );
    expect(out[0].text).toBe('extraordinary events.');
  });

  it('does not split on an abbreviation', () => {
    const out = buildSentences([item('Dr. Manette returned home.')], 792);
    expect(out.map((s) => s.text)).toEqual(['Dr. Manette returned home.']);
  });

  it('does not split on an initial', () => {
    const out = buildSentences([item('Written by J. R. R. Tolkien here.')], 792);
    expect(out).toHaveLength(1);
  });

  it('does not split on a dotted acronym', () => {
    // Found in a real document: "the Superintendent of Documents, U.S.
    // Government Printing Office" was being cut in two after "U.S.".
    const out = buildSentences([item('Sold by the U.S. Government Printing Office today.')], 792);
    expect(out.map((s) => s.text)).toEqual([
      'Sold by the U.S. Government Printing Office today.',
    ]);
  });

  it('does not split on a lowercase dotted abbreviation', () => {
    const out = buildSentences([item('It arrived at 4 p.m. and left again.')], 792);
    expect(out).toHaveLength(1);
  });

  it('keeps reading past a sentence that really did end in a dotted acronym', () => {
    // "U.S. Government" and "F.B.I. She" are the same shape, so no rule tells
    // them apart without a lexicon. Running the two together only costs a pause;
    // splitting mid-phrase would be read aloud as a wrong, jarring stop.
    const out = buildSentences([item('He worked for the F.B.I. She did not.')], 792);
    expect(out.map((s) => s.text)).toEqual(['He worked for the F.B.I. She did not.']);
  });

  it('marks a line repeating at the same spot on every page, and never as body', () => {
    const items = [];
    for (let page = 1; page <= 6; page++) {
      items.push(item('A Tale of Two Cities', { page, y: 20, fontSize: 8 }));
      items.push(item(`Body line for page ${page}.`, { page, y: 400 }));
    }
    const out = buildSentences(items, 792);
    expect(out.filter((s) => s.kind === 'body').map((s) => s.text)).toEqual([
      'Body line for page 1.',
      'Body line for page 2.',
      'Body line for page 3.',
      'Body line for page 4.',
      'Body line for page 5.',
      'Body line for page 6.',
    ]);
  });

  it('marks a running footer whose page number varies as a footer, not body', () => {
    const items = [];
    for (let page = 1; page <= 6; page++) {
      items.push(item(`Chapter 2 * ${page}`, { page, y: 18, fontSize: 8 }));
      items.push(item('The body carries on.', { page, y: 400 }));
    }
    const out = buildSentences(items, 792);
    expect(out.filter((s) => s.kind === 'body')).toHaveLength(6);
    expect(out.filter((s) => s.kind === 'footer')).toHaveLength(6);
    expect(out.every((s) => s.kind !== 'body' || s.text === 'The body carries on.')).toBe(true);
  });

  it('keeps edge text that only appears on a couple of pages', () => {
    const items = [];
    for (let page = 1; page <= 8; page++) {
      if (page <= 2) items.push(item('A dedication.', { page, y: 20 }));
      items.push(item('Body text here.', { page, y: 400 }));
    }
    const out = buildSentences(items, 792);
    expect(out.filter((s) => s.text === 'A dedication.')).toHaveLength(2);
  });

  it('keeps a repeated line that sits in the body rather than at the edge', () => {
    const items = [];
    for (let page = 1; page <= 6; page++) {
      items.push(item('And the raven answered.', { page, y: 400 }));
    }
    const out = buildSentences(items, 792);
    expect(out).toHaveLength(6);
  });

  it('drops a fragment with nothing speakable in it', () => {
    // Dot leaders in a table of contents ("Chapter One . . . . . 12") otherwise
    // become sentences that are a single period, and the engine is asked to
    // read silence aloud.
    const out = buildSentences(
      [item('Chapter One . . . . . 12 The story begins here.', { y: 400 })],
      792,
    );
    expect(out.every((s) => /[\p{L}\p{N}]/u.test(s.text))).toBe(true);
    expect(out.some((s) => s.text === '.')).toBe(false);
  });

  it('carries a sentence across a page boundary as one sentence', () => {
    const out = buildSentences(
      [
        item('He turned toward the', { page: 1, y: 60 }),
        item('window and waited.', { page: 2, y: 700 }),
      ],
      792,
    );
    expect(out).toHaveLength(1);
    expect(out[0].boxes.map((b) => b.page)).toEqual([1, 2]);
  });

  it('marks a bare page number as a footer so it is shown but not spoken', () => {
    const out = buildSentences(
      [item('A real sentence here.', { y: 700 }), item('42', { y: 40, fontSize: 9 })],
      792,
    );
    expect(out.filter((s) => s.kind === 'body').map((s) => s.text)).toEqual([
      'A real sentence here.',
    ]);
    expect(out.find((s) => s.text === '42')?.kind).toBe('footer');
  });

  it('marks a roman-numeral page number as a footer', () => {
    const out = buildSentences(
      [item('Front matter text.', { y: 700 }), item('xiv', { y: 40 })],
      792,
    );
    expect(out.filter((s) => s.kind === 'body')).toHaveLength(1);
    expect(out.find((s) => s.text === 'xiv')?.kind).toBe('footer');
  });

  it('keeps a number that appears in the body text', () => {
    const out = buildSentences(
      [item('He counted them all.', { y: 700 }), item('42', { y: 400 })],
      792,
    );
    expect(out).toHaveLength(2);
  });

  it('assigns contiguous indices across the whole document', () => {
    const out = buildSentences(
      [item('One. Two.', { page: 1 }), item('Three.', { page: 2 })],
      792,
    );
    expect(out.map((s) => s.index)).toEqual([0, 1, 2]);
  });

  it('returns nothing for an empty document', () => {
    expect(buildSentences([], 792)).toEqual([]);
  });

  it('emits a trailing fragment that has no terminal punctuation', () => {
    const out = buildSentences([item('An unfinished thought')], 792);
    expect(out.map((s) => s.text)).toEqual(['An unfinished thought']);
  });
});
