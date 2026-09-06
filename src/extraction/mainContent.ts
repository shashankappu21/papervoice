import type { Sentence } from './types';

/**
 * Finds where a book's actual content begins, so a listener can skip the
 * dedication and the contents page and start at the first chapter.
 *
 * Nothing is removed: this only reports a place to start. Reading the whole
 * document from its first word stays the default, because front matter is a
 * convention rather than a rule, and a book that does not follow it would
 * otherwise lose its opening.
 */

/** Headings that announce front matter rather than content. */
const FRONT_MATTER = [
  /^(table of )?contents$/i,
  /^dedication$/i,
  /^copyright$/i,
  /^title page$/i,
  /^also by\b/i,
  /^praise for\b/i,
  /^epigraph$/i,
  /^about the (author|publisher)s?$/i,
  /^colophon$/i,
];

/**
 * The most of a document that may be skipped. A "contents" heading in the
 * middle of a book is something else -- a chapter about contents, a back-matter
 * index -- and skipping to it would swallow the book.
 */
const MOST_SKIPPABLE = 0.15;

/**
 * The index of the first sentence of the main content, or `null` when there is
 * nothing worth skipping -- which is also the answer for a document with no
 * headings, or one whose front matter cannot be told apart from its content.
 */
export function findMainContentStart(sentences: Sentence[]): number | null {
  const limit = Math.floor(sentences.length * MOST_SKIPPABLE);
  if (limit === 0) return null;

  const headings = sentences.filter((s) => s.kind === 'heading');

  let lastFrontMatter = -1;
  for (const heading of headings) {
    if (heading.index > limit) break;
    if (FRONT_MATTER.some((pattern) => pattern.test(heading.text.trim()))) {
      lastFrontMatter = heading.index;
    }
  }
  if (lastFrontMatter === -1) return null;

  // Content starts at the next heading: the chapter title itself is worth
  // hearing, and it is the first thing a reader would look at on the page.
  const next = headings.find((heading) => heading.index > lastFrontMatter);
  if (!next || next.index > limit) return null;

  return next.index;
}
