import { buildBlocks } from './blocks';
import { buildLines } from './lines';
import type { BBox, Block, Line, Sentence, TextItem } from './types';

/** Words ending in '.' that do not end a sentence. */
const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'jr', 'sr', 'vs', 'etc',
  'inc', 'ltd', 'co', 'no', 'fig', 'figs', 'vol', 'ch', 'ed', 'eds', 'pp',
  'al', 'ca', 'cf', 'eg', 'ie',
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

/** Cuts one block's text at real sentence boundaries. */
function splitSpans(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    if (!/[.!?]/.test(text[i])) continue;

    let j = i + 1;
    while (j < text.length && CLOSERS.test(text[j])) j++;
    // A terminator must be followed by whitespace or the end of the block, so
    // decimals ("3.5") and URLs do not split.
    if (j < text.length && !/\s/.test(text[j])) continue;
    if (!isSentenceEnd(text.slice(start, j))) continue;

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
    // utterance, so it is taken whole.
    const spans = block.kind === 'heading' ? [[0, block.text.length] as [number, number]] : splitSpans(block.text);

    for (const [start, end] of spans) {
      const text = block.text.slice(start, end).replace(/\s+/g, ' ').trim();
      // Nothing to say: punctuation on its own, such as the dot leaders in a
      // table of contents. Each one would cost a synthesis slot and a silence.
      if (!/[\p{L}\p{N}]/u.test(text)) continue;

      sentences.push({
        index: sentences.length,
        kind: block.kind,
        text,
        boxes: boxesFor(block, start, end),
      });
    }
  }

  return sentences;
}
