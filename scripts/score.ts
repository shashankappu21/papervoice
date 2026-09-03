/**
 * Scores extraction quality over a fixture. Run before and after a change to
 * see whether splitting actually improved:
 *
 *   npx vite-node scripts/score.ts -- fixtures/local/never-split.items.json
 *
 * These are proxies, not truth -- no corpus of correctly-split books exists to
 * check against -- but each one counts a defect we have seen in a real book.
 */
import fs from 'node:fs';
import { buildSentences } from '../src/extraction/sentences';
import type { Sentence, TextItem } from '../src/extraction/types';

const path = process.argv[2];
const doc = JSON.parse(fs.readFileSync(path, 'utf8')) as {
  items: TextItem[];
  pageHeight: number;
  pageCount: number;
};
const sentences = buildSentences(doc.items, doc.pageHeight);

/** A run of three or more shouted words inside a sentence: a swallowed heading. */
const HEADING_RUN = /(?:\b[A-Z][A-Z’'-]{2,}\b[ ,]+){3,}/;
/** Dot leaders from a table of contents. */
const DOT_LEADER = /(?:\.\s?){4,}/;

const lengths = sentences.map((s) => s.text.length).sort((a, b) => a - b);
const at = (q: number) => lengths[Math.floor(lengths.length * q)] ?? 0;
const count = (fn: (s: Sentence) => boolean) => sentences.filter(fn).length;

const defects = {
  'swallowed heading': count((s) => HEADING_RUN.test(s.text)),
  'dot leaders': count((s) => DOT_LEADER.test(s.text)),
  'run-on (>400 chars)': count((s) => s.text.length > 400),
  'huge (>800 chars)': count((s) => s.text.length > 800),
  'fragment (<15 chars)': count((s) => s.text.length < 15),
  'nothing speakable': count((s) => !/[\p{L}\p{N}]/u.test(s.text)),
  'spans 3+ pages': count((s) => new Set(s.boxes.map((b) => b.page)).size > 2),
};

console.log(`${path}`);
console.log(`  ${doc.pageCount} pages, ${doc.items.length} items -> ${sentences.length} sentences`);
console.log(`  length p50=${at(0.5)} p90=${at(0.9)} p99=${at(0.99)} max=${lengths[lengths.length - 1]}`);
for (const [name, n] of Object.entries(defects)) {
  const pct = ((n / sentences.length) * 100).toFixed(1);
  console.log(`  ${name.padEnd(22)} ${String(n).padStart(5)}  (${pct}%)`);
}
