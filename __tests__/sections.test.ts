import { describe, expect, it } from 'vitest';
import { buildSections, type OutlineEntry } from '../src/extraction/sections';
import type { Sentence } from '../src/extraction/types';

const say = (
  index: number,
  text: string,
  kind: Sentence['kind'] = 'body',
  page = 1,
): Sentence => ({
  index,
  kind,
  text,
  boxes: [{ page, x: 0, y: 0, width: 10, height: 10 }],
});

describe('buildSections from an embedded outline', () => {
  const outline: OutlineEntry[] = [
    { title: 'Chapter One', page: 1, depth: 0 },
    { title: 'Chapter Two', page: 3, depth: 0 },
  ];

  const book = [
    say(0, 'First page.', 'body', 1),
    say(1, 'Still page one.', 'body', 1),
    say(2, 'Page two.', 'body', 2),
    say(3, 'Page three.', 'body', 3),
    say(4, 'Also page three.', 'body', 3),
  ];

  it('lands each entry on the first sentence of its page', () => {
    expect(buildSections(book, outline)).toEqual([
      { title: 'Chapter One', index: 0, depth: 0 },
      { title: 'Chapter Two', index: 3, depth: 0 },
    ]);
  });

  it('prefers the outline over headings when both exist', () => {
    const withHeading = [...book, say(5, 'A DETECTED HEADING', 'heading', 3)];
    const titles = buildSections(withHeading, outline).map((s) => s.title);
    // The publisher's own contents page beats anything inferred from font size.
    expect(titles).toEqual(['Chapter One', 'Chapter Two']);
  });

  it('drops an entry pointing past the end of what was extracted', () => {
    const beyond: OutlineEntry[] = [...outline, { title: 'Index', page: 99, depth: 0 }];
    expect(buildSections(book, beyond).map((s) => s.title)).toEqual([
      'Chapter One',
      'Chapter Two',
    ]);
  });

  it('keeps only the first of several entries landing in one place', () => {
    const crowded: OutlineEntry[] = [
      { title: 'Title Page', page: 1, depth: 0 },
      { title: 'Copyright', page: 1, depth: 0 },
      { title: 'Chapter Two', page: 3, depth: 0 },
    ];
    // Two rows that jump to the same sentence are one row a reader can use.
    expect(buildSections(book, crowded).map((s) => s.index)).toEqual([0, 3]);
  });
});

describe('buildSections from detected headings', () => {
  const book = [
    say(0, 'THE FBI GETS EMOTIONAL', 'heading', 1),
    say(1, 'Some prose.', 'body', 1),
    say(2, 'More prose.', 'body', 2),
    say(3, 'MIRRORING', 'heading', 2),
    say(4, 'Closing prose.', 'body', 2),
  ];

  it('uses headings when there is no outline', () => {
    expect(buildSections(book, null)).toEqual([
      { title: 'THE FBI GETS EMOTIONAL', index: 0, depth: 0 },
      { title: 'MIRRORING', index: 3, depth: 0 },
    ]);
  });

  it('treats an empty outline as no outline', () => {
    expect(buildSections(book, []).map((s) => s.title)).toEqual([
      'THE FBI GETS EMOTIONAL',
      'MIRRORING',
    ]);
  });
});

describe('when there is nothing worth showing', () => {
  it('offers nothing for a book with a single section', () => {
    // One row that goes to the top is a list that helps nobody.
    const book = [say(0, 'ONLY HEADING', 'heading', 1), say(1, 'Prose.', 'body', 1)];
    expect(buildSections(book, null)).toEqual([]);
  });

  it('offers nothing for a book with no structure at all', () => {
    expect(buildSections([say(0, 'Just prose.', 'body', 1)], null)).toEqual([]);
  });

  it('survives a sentence with no boxes', () => {
    const odd: Sentence = { index: 0, kind: 'body', text: 'No boxes.', boxes: [] };
    expect(() => buildSections([odd], [{ title: 'A', page: 1, depth: 0 }])).not.toThrow();
  });
});

describe('tidying titles', () => {
  it('collapses whitespace and trims a title that runs on', () => {
    const book = [say(0, 'a', 'body', 1), say(1, 'b', 'body', 2)];
    const long = 'x'.repeat(200);
    const [first] = buildSections(book, [
      { title: `  Chapter\n  One  `, page: 1, depth: 0 },
      { title: long, page: 2, depth: 0 },
    ]);
    expect(first.title).toBe('Chapter One');
  });

  it('ignores an entry with no title at all', () => {
    const book = [say(0, 'a', 'body', 1), say(1, 'b', 'body', 2), say(2, 'c', 'body', 3)];
    const titles = buildSections(book, [
      { title: '   ', page: 1, depth: 0 },
      { title: 'Real', page: 2, depth: 0 },
      { title: 'Also real', page: 3, depth: 0 },
    ]).map((s) => s.title);
    expect(titles).toEqual(['Real', 'Also real']);
  });
});
