import { buildBlocks } from './blocks';
import { buildLines } from './lines';
import type { BBox, Block, Line, Sentence, TextItem } from './types';

/** Words ending in '.' that do not end a sentence. */
const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'jr', 'sr', 'vs', 'etc',
  'inc', 'ltd', 'co', 'no', 'fig', 'figs', 'vol', 'ch', 'ed', 'eds', 'pp',
  'al', 'ca', 'cf', 'eg', 'ie',
  // Currency and measure abbreviations, which are followed by the amount they
  // describe: "a deposit of Rs. 14,000" must not be cut after "Rs."
  'rs', 'usd', 'inr', 'approx', 'est',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
]);

/** Closing punctuation that may follow a terminator: `he said."` */
const CLOSERS = /["'’”)\]]/;

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

/**
 * An ellipsis, written as one character or as separated periods. Books set it
 * the long way ("away . . . and never"), and each of those periods looks exactly
 * like the end of a sentence.
 */
const ELLIPSIS = /^(?:…|\.(?:[   ]?\.)+)/;

/** Cuts one block's text at real sentence boundaries. */
function splitSpans(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    if (!/[.!?…]/.test(text[i])) continue;

    const ellipsis = ELLIPSIS.exec(text.slice(i));
    let j = i + (ellipsis ? ellipsis[0].length : 1);
    while (j < text.length && CLOSERS.test(text[j])) j++;
    // A terminator must be followed by whitespace or the end of the block, so
    // decimals ("3.5") and URLs do not split.
    if (j < text.length && !/\s/.test(text[j])) continue;

    if (ellipsis) {
      // An ellipsis trails off far more often than it ends a sentence, so it
      // only ends one when what follows opens like a new sentence.
      if (!/^\s*["'‘“(]?\p{Lu}/u.test(text.slice(j))) {
        i = j - 1;
        continue;
      }
    } else if (!isSentenceEnd(text.slice(start, j))) {
      continue;
    }

    spans.push([start, j]);
    start = j;
    i = j - 1;
  }
  if (start < text.length) spans.push([start, text.length]);
  return spans;
}

function toBox(line: Line): BBox {
  return { page: line.page, x: line.x, y: line.y, width: line.width, height: line.height };
}

/** Every line of the block that overlaps the character range [start, end). */
function boxesFor(block: Block, start: number, end: number): BBox[] {
  const boxes: BBox[] = [];
  block.lines.forEach((line, i) => {
    const lineStart = block.lineOffsets[i];
    const lineEnd = lineStart + line.text.length;
    if (lineStart < end && lineEnd > start) boxes.push(toBox(line));
  });
  return boxes;
}

/**
 * Turns raw pdf.js text items into speakable sentences.
 *
 * The work happens in three stages -- items become lines, lines become
 * classified blocks, and only then is text cut into sentences. Sentences never
 * cross a block boundary, which is what stops a heading from being welded onto
 * the paragraph beneath it and a footnote from landing in the middle of a
 * clause.
 */
export function buildSentences(items: TextItem[], pageHeight: number): Sentence[] {
  const blocks = buildBlocks(buildLines(items), pageHeight);
  const sentences: Sentence[] = [];

  for (const block of blocks) {
    if (block.kind === 'furniture') continue;

    // A heading has no terminal punctuation to split on and is read as one
    // utterance, so it is taken whole. So are headers and footers: a running
    // title is one label, not a series of sentences.
    const whole = block.kind === 'heading' || block.kind === 'header' || block.kind === 'footer';
    const spans = whole ? [[0, block.text.length] as [number, number]] : splitSpans(block.text);

    // Stray punctuation attaches to a neighbour, but only inside its own block:
    // it must never be welded onto the last sentence of the block before.
    const firstOfBlock = sentences.length;
    let pending = '';

    for (const [start, end] of spans) {
      const text = block.text.slice(start, end).replace(/\s+/g, ' ').trim();

      // Punctuation with no words around it is not an utterance. It still
      // belongs on the page, and a stranded '?' changes how the sentence before
      // it is read, so it joins that sentence rather than being dropped.
      if (!/[\p{L}\p{N}]/u.test(text)) {
        const previous = sentences[sentences.length - 1];
        if (text.length > 0 && previous && sentences.length > firstOfBlock) {
          previous.text = `${previous.text} ${text}`;
          previous.boxes = boxesFor(block, start, end).reduce(
            (boxes, box) => (boxes.some((b) => b.page === box.page && b.y === box.y) ? boxes : [...boxes, box]),
            previous.boxes,
          );
        } else if (text.length > 0) {
          pending = pending.length > 0 ? `${pending} ${text}` : text;
        }
        continue;
      }

      sentences.push({
        index: sentences.length,
        kind: block.kind,
        text: pending.length > 0 ? `${pending} ${text}` : text,
        boxes: boxesFor(block, start, end),
      });
      pending = '';
    }
  }

  return sentences;
}
