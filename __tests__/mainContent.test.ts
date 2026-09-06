import { describe, it, expect } from 'vitest';
import { findMainContentStart } from '../src/extraction/mainContent';
import type { Sentence } from '../src/extraction/types';

const s = (text: string, kind: Sentence['kind'] = 'body'): Omit<Sentence, 'index'> => ({
  kind,
  text,
  boxes: [],
});

/** Builds a document from parts, numbering the sentences as extraction would. */
const doc = (...parts: Array<Omit<Sentence, 'index'>>): Sentence[] =>
  parts.map((part, index) => ({ ...part, index }));

const body = (count: number, from = 0): Array<Omit<Sentence, 'index'>> =>
  Array.from({ length: count }, (_, i) => s(`Body sentence number ${from + i}.`));

describe('findMainContentStart', () => {
  it('points at the first chapter after a contents page', () => {
    const sentences = doc(
      s('DEDICATION', 'heading'),
      s('For my mother and father.'),
      s('CONTENTS', 'heading'),
      s('CHAPTER 1 THE NEW RULES How to Become the Smartest Person'),
      s('THE NEW RULES', 'heading'),
      ...body(40),
    );
    expect(findMainContentStart(sentences)).toBe(4);
  });

  it('offers nothing to skip when the document has no front matter', () => {
    const sentences = doc(s('THE NEW RULES', 'heading'), ...body(40));
    expect(findMainContentStart(sentences)).toBeNull();
  });

  it('offers nothing to skip when the document has no headings at all', () => {
    expect(findMainContentStart(doc(...body(40)))).toBeNull();
  });

  it('refuses to skip an unreasonable share of the document', () => {
    // A "contents" heading late in a short document is not front matter, and
    // skipping to it would swallow most of the book.
    const sentences = doc(
      ...body(20),
      s('CONTENTS', 'heading'),
      s('THE END', 'heading'),
      ...body(2, 20),
    );
    expect(findMainContentStart(sentences)).toBeNull();
  });

  it('recognises the usual front matter titles whatever their case', () => {
    const sentences = doc(
      s('Table of Contents', 'heading'),
      s('Chapter One . . . 12'),
      s('Chapter One', 'heading'),
      ...body(40),
    );
    expect(findMainContentStart(sentences)).toBe(2);
  });

  it('skips past the last piece of front matter, not the first', () => {
    const sentences = doc(
      s('COPYRIGHT', 'heading'),
      s('All rights reserved.'),
      s('DEDICATION', 'heading'),
      s('For my mother.'),
      s('CONTENTS', 'heading'),
      s('Chapter one is here'),
      s('THE NEW RULES', 'heading'),
      ...body(40),
    );
    expect(findMainContentStart(sentences)).toBe(6);
  });
});
