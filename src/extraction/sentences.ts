import type { TextItem, Sentence, BBox } from './types';

/** Words ending in '.' that do not end a sentence. */
const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'jr', 'sr', 'vs', 'etc',
  'inc', 'ltd', 'co', 'no', 'fig', 'figs', 'vol', 'ch', 'ed', 'eds', 'pp',
  'al', 'ca', 'cf', 'eg', 'ie',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
]);

const PAGE_NUMBER_PATTERNS = [
  /^\d{1,4}$/,
  /^[ivxlcdm]{1,7}$/i,
  /^\d+\s*of\s*\d+$/i,
  /^page\s+\d+$/i,
];

/** Closing punctuation that may follow a terminator: `he said."` */
const CLOSERS = /["'’”)\]]/;

/**
 * Page furniture is only stripped near the top or bottom edge, so a number in
 * the body ("He counted them all. 42") survives.
 */
function isNearEdge(item: TextItem, pageHeight: number): boolean {
  return item.y < pageHeight * 0.08 || item.y > pageHeight * 0.92;
}

/**
 * Identifies an edge item by where it sits and what it says, with digits
 * flattened so a footer only differing by its page number ("Chapter 2 * 14")
 * still counts as the same footer.
 */
function furnitureKey(item: TextItem): string {
  const band = Math.round(item.y / 6);
  return `${band}|${item.text.trim().replace(/\d+/g, '#')}`;
}

/**
 * Running heads and feet repeat in the same place page after page. They are
 * found by that repetition rather than by pattern, because the text varies by
 * book — a title, a chapter name, a printer's watermark. They have to go: left
 * in, they are spliced into the middle of a body sentence and read aloud.
 */
function findRunningFurniture(items: TextItem[], pageHeight: number): Set<string> {
  const pagesByKey = new Map<string, Set<number>>();
  const pages = new Set<number>();

  for (const item of items) {
    pages.add(item.page);
    if (!isNearEdge(item, pageHeight)) continue;
    if (item.text.trim().length === 0) continue;
    const key = furnitureKey(item);
    let seen = pagesByKey.get(key);
    if (!seen) pagesByKey.set(key, (seen = new Set()));
    seen.add(item.page);
  }

  // Three pages is the floor: two repetitions could be a dedication or an
  // epigraph, and a short document has no running furniture worth guessing at.
  const threshold = Math.max(3, pages.size * 0.5);
  const running = new Set<string>();
  for (const [key, seen] of pagesByKey) {
    if (seen.size >= threshold) running.add(key);
  }
  return running;
}

function isPageFurniture(
  item: TextItem,
  pageHeight: number,
  running: Set<string>,
): boolean {
  const text = item.text.trim();
  if (text.length === 0) return true;
  if (!isNearEdge(item, pageHeight)) return false;
  if (running.has(furnitureKey(item))) return true;
  return PAGE_NUMBER_PATTERNS.some((re) => re.test(text));
}

/** True if `text` genuinely ends a sentence rather than an abbreviation or initial. */
function isSentenceEnd(text: string): boolean {
  const trimmed = text.trimEnd();
  if (trimmed.length === 0) return false;

  const withoutClosers = trimmed.replace(/["'’”)\]]+$/, '');
  if (!/[.!?]$/.test(withoutClosers)) return false;
  // '!' and '?' are unambiguous; only '.' needs the abbreviation check.
  if (!withoutClosers.endsWith('.')) return true;

  const lastWord = withoutClosers.split(/\s+/).pop() ?? '';
  const bare = lastWord
    .slice(0, -1)
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .toLowerCase();

  if (ABBREVIATIONS.has(bare)) return false;
  if (/^\p{L}$/u.test(bare)) return false; // a single initial: "J."
  // A dotted acronym: "U.S.", "p.m.", "F.B.I.". A real sentence can end in one,
  // but nothing distinguishes that from "U.S. Government" without a lexicon, and
  // a missing pause reads better aloud than a stop in the middle of a phrase.
  if (/^(?:\p{L}\.)+\p{L}$/u.test(bare)) return false;
  return true;
}

function toBox(item: TextItem): BBox {
  return { page: item.page, x: item.x, y: item.y, width: item.width, height: item.height };
}

/** Merge boxes lying on the same line of the same page into one run. */
function mergeBoxes(boxes: BBox[]): BBox[] {
  const out: BBox[] = [];
  for (const box of boxes) {
    const prev = out[out.length - 1];
    if (prev && prev.page === box.page && Math.abs(prev.y - box.y) <= 2) {
      const right = Math.max(prev.x + prev.width, box.x + box.width);
      prev.x = Math.min(prev.x, box.x);
      prev.width = right - prev.x;
      prev.height = Math.max(prev.height, box.height);
    } else {
      out.push({ ...box });
    }
  }
  return out;
}

interface Piece {
  start: number;
  end: number;
  item: TextItem;
}

/**
 * Groups pdf.js text items into sentences, preserving for each sentence every
 * bounding box that contributed to it (so a sentence may span lines and pages).
 */
export function buildSentences(items: TextItem[], pageHeight: number): Sentence[] {
  // Phase 1 — concatenate the document into one string, remembering which item
  // produced each character range.
  const pieces: Piece[] = [];
  let full = '';
  const running = findRunningFurniture(items, pageHeight);

  for (const item of items) {
    if (isPageFurniture(item, pageHeight, running)) continue;

    if (full.length > 0) {
      if (/-$/.test(full)) {
        // A word hyphenated across a line break: drop the hyphen and join.
        full = full.slice(0, -1);
        const prev = pieces[pieces.length - 1];
        if (prev) prev.end = Math.min(prev.end, full.length);
      } else if (!/\s$/.test(full) && !/^\s/.test(item.text)) {
        full += ' ';
      }
    }

    const start = full.length;
    full += item.text;
    pieces.push({ start, end: full.length, item });
  }

  // Phase 2 — cut the string at real sentence boundaries.
  const spans: Array<[number, number]> = [];
  let spanStart = 0;

  for (let i = 0; i < full.length; i++) {
    if (!/[.!?]/.test(full[i])) continue;

    let j = i + 1;
    while (j < full.length && CLOSERS.test(full[j])) j++;
    // A terminator must be followed by whitespace or end of document, so
    // decimals ("3.5") and URLs do not split.
    if (j < full.length && !/\s/.test(full[j])) continue;
    if (!isSentenceEnd(full.slice(spanStart, j))) continue;

    spans.push([spanStart, j]);
    spanStart = j;
    i = j - 1;
  }
  if (spanStart < full.length) spans.push([spanStart, full.length]);

  // Phase 3 — emit sentences, attaching every box that overlaps the span.
  const sentences: Sentence[] = [];
  for (const [start, end] of spans) {
    const text = full.slice(start, end).replace(/\s+/g, ' ').trim();
    // Nothing to say: an empty span, or punctuation on its own. Dot leaders in
    // a table of contents produce runs of these, and every one would cost a
    // synthesis slot and a silent gap in playback.
    if (!/[\p{L}\p{N}]/u.test(text)) continue;

    const boxes = pieces
      .filter((p) => p.start < end && p.end > start)
      .map((p) => toBox(p.item));

    sentences.push({ index: sentences.length, text, boxes: mergeBoxes(boxes) });
  }

  return sentences;
}
