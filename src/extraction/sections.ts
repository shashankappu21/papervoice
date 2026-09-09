import type { Sentence } from './types';

/**
 * A row of the PDF's own contents, as the file records it.
 *
 * This is what Adobe and Chrome show in their sidebars. It is written by the
 * publisher rather than inferred, so where it exists it is worth more than
 * anything we could work out from font sizes.
 */
export interface OutlineEntry {
  title: string;
  /** 1-based, matching the pages recorded on every sentence's boxes. */
  page: number;
  /** How deeply nested: 0 for a chapter, 1 for a section inside it. */
  depth: number;
}

/** Somewhere a reader can jump to, resolved to a place in the text. */
export interface Section {
  title: string;
  /** The sentence to start reading from. */
  index: number;
  depth: number;
}

/** Long enough to recognise a chapter, short enough for one line of a sheet. */
const LONGEST_TITLE = 80;

/** Below this there is nothing to navigate, so nothing is offered. */
const FEWEST_SECTIONS = 2;

const tidy = (title: string): string =>
  title.replace(/\s+/g, ' ').trim().slice(0, LONGEST_TITLE);

/** The page a sentence starts on, or null when it has no boxes to say. */
const pageOf = (sentence: Sentence): number | null => sentence.boxes[0]?.page ?? null;

/**
 * Where a reader can jump to in a book.
 *
 * The file's own outline is used when it has one, because a publisher's
 * contents page beats anything inferred from how large the type is. Failing
 * that, the headings extraction already found stand in -- which is why a book
 * with neither simply gets no list, rather than a bad one.
 */
export function buildSections(
  sentences: Sentence[],
  outline?: OutlineEntry[] | null,
): Section[] {
  const found = outline?.length ? fromOutline(sentences, outline) : fromHeadings(sentences);

  // One row, pointing at the top, is a list that helps nobody.
  return found.length >= FEWEST_SECTIONS ? found : [];
}

function fromOutline(sentences: Sentence[], outline: OutlineEntry[]): Section[] {
  // The first sentence to appear on each page, so an entry naming a page can
  // be turned into somewhere to start reading.
  const firstOnPage = new Map<number, number>();
  for (const sentence of sentences) {
    const page = pageOf(sentence);
    if (page === null || firstOnPage.has(page)) continue;
    firstOnPage.set(page, sentence.index);
  }

  const pages = [...firstOnPage.keys()].sort((a, b) => a - b);

  const sections: Section[] = [];
  const taken = new Set<number>();

  for (const entry of outline) {
    const title = tidy(entry.title);
    if (!title) continue;

    // The named page may hold no text of its own -- a plate, or a blank verso
    // -- so the next page that does is where the chapter actually starts.
    const landing = pages.find((page) => page >= entry.page);
    if (landing === undefined) continue;

    const index = firstOnPage.get(landing);
    // Several entries landing in one place -- a title page and its copyright
    // notice -- are one row a reader can use.
    if (index === undefined || taken.has(index)) continue;

    taken.add(index);
    sections.push({ title, index, depth: entry.depth });
  }

  return sections.sort((a, b) => a.index - b.index);
}

function fromHeadings(sentences: Sentence[]): Section[] {
  return sentences
    .filter((sentence) => sentence.kind === 'heading')
    .map((sentence) => ({ title: tidy(sentence.text), index: sentence.index, depth: 0 }))
    .filter((section) => section.title.length > 0);
}
