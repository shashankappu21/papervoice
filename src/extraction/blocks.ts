import type { Block, BlockKind, Line, TextItem } from './types';

/**
 * Groups lines into blocks and classifies each one. Font size is measured
 * against the document's own body size rather than any absolute number, so a
 * book set in 15pt and a paper set in 9pt are read the same way.
 */
export function buildBlocks(lines: Line[], pageHeight: number): Block[] {
  const bodySize = findBodySize(lines);
  const leading = findLeading(lines);
  const edges = findPageEdgeLines(lines);
  const running = findRunningFurniture(lines, pageHeight, edges);
  const kindOf = (line: Line) =>
    classifyLine(line, bodySize, pageHeight, running, edges.has(line));

  const blocks: Block[] = [];
  let current: Line[] = [];

  const flush = () => {
    if (current.length === 0) return;
    blocks.push(toBlock(current, kindOf));
    current = [];
  };

  for (const line of lines) {
    const previous = current[current.length - 1];
    if (previous && !continues(previous, line, kindOf, leading)) flush();
    current.push(line);
  }
  flush();

  return blocks;
}

/** True if `line` belongs to the same block as `previous`. */
function continues(
  previous: Line,
  line: Line,
  kindOf: (line: Line) => BlockKind,
  leading: number,
): boolean {
  // A change of purpose ends a block: a heading, a footnote, a running header.
  const kind = kindOf(previous);
  if (kind !== kindOf(line)) return false;

  if (previous.page !== line.page) {
    // Only prose carries across a page break, and only mid-sentence: anything
    // that finished on the previous page starts afresh on the next.
    return kind === 'body' && !/[.!?][”"')\]]?$/.test(previous.text.trimEnd());
  }

  // A heading is set with generous space around it, and a title often runs to
  // several lines; those lines are one heading, not one heading per line.
  const limit = kind === 'heading' ? leading * 3 : leading * 1.4;

  // Lines set further apart than the document's own leading start a paragraph.
  return previous.y - line.y <= limit;
}

/**
 * Dot leaders in a table of contents: "Chapter One . . . . . . 12". Six is the
 * floor, not four: an ellipsis ending a sentence is set as four spaced dots
 * ("I was in love. . . . I never said so"), and treating that as a leader
 * deletes the sentence around it.
 */
const DOT_LEADERS = /(?:\.\s?){6,}/;

/**
 * A line at the page edge that is only a page number. Checked by pattern rather
 * than by repetition because the number changes on every page, and only near an
 * edge so a number in the body ("He counted them all. 42") survives.
 */
const NUMBER_ONLY = /^\(?\d{1,4}\)?[.]?$|^\(?[ivxlcdm]{1,7}\)?[.]?$/i;

const PAGE_NUMBER_PATTERNS = [
  /^\d{1,4}$/,
  /^[ivxlcdm]{1,7}$/i,
  /^\d+\s*of\s*\d+$/i,
  /^page\s+\d+$/i,
];

function classifyLine(
  line: Line,
  bodySize: number,
  pageHeight: number,
  running: Set<string>,
  opensOrClosesPage: boolean,
): BlockKind {
  const text = line.text.trim();
  if (DOT_LEADERS.test(text)) return 'furniture';
  if (isNearEdge(line.y, pageHeight) || opensOrClosesPage) {
    if (runningShare(line, running) >= FURNITURE_SHARE) return 'furniture';
    if (PAGE_NUMBER_PATTERNS.some((re) => re.test(text))) return 'furniture';
  }
  if (line.fontSize > bodySize * 1.1) return 'heading';
  if (line.fontSize < bodySize * 0.9) {
    // Marginal line numbers, set in small type down the side of a legal or
    // scholarly text. They are numbers with no sentence around them, and the
    // small size is what separates them from a number in the prose.
    if (NUMBER_ONLY.test(text)) return 'furniture';
    // A footnote is small AND at the foot of the page. Books also set whole
    // passages -- a preamble, an epigraph, a block quotation -- smaller than the
    // body, and those are prose the listener wants read.
    if (line.y < pageHeight * 0.4) return 'note';
    return 'body';
  }
  return 'body';
}

function toBlock(lines: Line[], kindOf: (line: Line) => BlockKind): Block {
  let text = '';
  const lineOffsets: number[] = [];

  for (const line of lines) {
    if (text.length === 0) {
      // nothing to join to
    } else if (/[\p{L}]-$/u.test(text)) {
      text = text.slice(0, -1); // a word hyphenated across a line break
    } else {
      text += ' ';
    }
    lineOffsets.push(text.length);
    text += line.text;
  }

  return {
    kind: kindOf(lines[0]),
    page: lines[0].page,
    text,
    lines,
    lineOffsets,
  };
}

function isNearEdge(y: number, pageHeight: number): boolean {
  return y < pageHeight * 0.08 || y > pageHeight * 0.92;
}

/**
 * Identifies an edge item by where it sits and what it says, with digits
 * flattened so a footer differing only by its page number still matches.
 */
function furnitureKey(item: TextItem): string {
  return `${Math.round(item.y / 6)}|${item.text.trim().replace(/\d+/g, '#')}`;
}

/**
 * Running heads and feet repeat in the same place page after page. They are
 * found by that repetition rather than by pattern, because the text varies by
 * book -- a title, a chapter name, a printer's watermark.
 *
 * Matching is per item, not per line: one page's footer often carries an extra
 * fragment the others lack, and matching whole lines would let that page's
 * footer through intact. Short runs are ignored, because a PDF emits a line as
 * many small pieces and the short ones -- "I", "was", "and" -- recur at the same
 * height in any book, which is enough to condemn a unique sentence.
 */
const MIN_FURNITURE_RUN = 3;

/**
 * How much of a line must repeat before it is furniture rather than prose.
 * Measured on two real books, the split is wide: running footers score 0.65 to
 * 1.0 (one page's footer carries an extra fragment, which is what puts the
 * floor at 0.65), and no prose line anywhere in either book scores above 0.3.
 */
const FURNITURE_SHARE = 0.6;

function findRunningFurniture(
  lines: Line[],
  pageHeight: number,
  edges: Set<Line>,
): Set<string> {
  const pagesByKey = new Map<string, Set<number>>();
  const pages = new Set<number>();

  for (const line of lines) {
    pages.add(line.page);
    if (!isNearEdge(line.y, pageHeight) && !edges.has(line)) continue;
    for (const item of line.items) {
      if (item.text.trim().length < MIN_FURNITURE_RUN) continue;
      const key = furnitureKey(item);
      let seen = pagesByKey.get(key);
      if (!seen) pagesByKey.set(key, (seen = new Set()));
      seen.add(item.page);
    }
  }

  // Three pages is the floor: two repetitions could be a dedication or an
  // epigraph, and a short document has no running furniture worth guessing at.
  const threshold = Math.max(3, pages.size * 0.5);
  const running = new Set<string>();
  for (const [key, seen] of pagesByKey) if (seen.size >= threshold) running.add(key);
  return running;
}

/**
 * The first and last line of each page. A running head or foot is often nowhere
 * near the physical page edge -- a facsimile prints a small page inside a large
 * one -- but it always opens or closes the page. Pages with only a line or two
 * are skipped: there, opening the page means nothing.
 */
function findPageEdgeLines(lines: Line[]): Set<Line> {
  const byPage = new Map<number, Line[]>();
  for (const line of lines) {
    const page = byPage.get(line.page);
    if (page) page.push(line);
    else byPage.set(line.page, [line]);
  }

  const edges = new Set<Line>();
  for (const page of byPage.values()) {
    if (page.length < 3) continue;
    edges.add(page[0]);
    edges.add(page[page.length - 1]);
  }
  return edges;
}

/** How much of the line's text comes from items that repeat page after page. */
function runningShare(line: Line, running: Set<string>): number {
  if (line.items.length === 0) return 0;
  let repeated = 0;
  let total = 0;
  for (const item of line.items) {
    const length = item.text.trim().length;
    if (length < MIN_FURNITURE_RUN) continue;
    total += length;
    if (running.has(furnitureKey(item))) repeated += length;
  }
  return total === 0 ? 0 : repeated / total;
}

/** The size most of the document's text is set in. */
function findBodySize(lines: Line[]): number {
  const weight = new Map<number, number>();
  for (const line of lines) {
    weight.set(line.fontSize, (weight.get(line.fontSize) ?? 0) + line.text.length);
  }
  return [...weight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 12;
}

/** The most common distance between consecutive lines: the document's leading. */
function findLeading(lines: Line[]): number {
  const gaps = new Map<number, number>();
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].page !== lines[i - 1].page) continue;
    const gap = Math.round((lines[i - 1].y - lines[i].y) * 2) / 2;
    if (gap > 0) gaps.set(gap, (gaps.get(gap) ?? 0) + 1);
  }
  const common = [...gaps.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return common ?? 14;
}
