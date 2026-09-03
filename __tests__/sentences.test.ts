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

  it('drops a bare page number', () => {
    const out = buildSentences(
      [item('A real sentence here.', { y: 700 }), item('42', { y: 40, fontSize: 9 })],
      792,
    );
    expect(out.map((s) => s.text)).toEqual(['A real sentence here.']);
  });

  it('drops a roman-numeral page number', () => {
    const out = buildSentences(
      [item('Front matter text.', { y: 700 }), item('xiv', { y: 40 })],
      792,
    );
    expect(out).toHaveLength(1);
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
