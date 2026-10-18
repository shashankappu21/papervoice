/**
 * Reads the starter book the way the app will, and says what a listener gets.
 *
 *   npm run starter-book:check
 *
 * The shipped extractor page has already run over the PDF (in plain Node, by
 * scripts/extractFixture.mjs -- it will not load under vite-node). This runs
 * the same sentence and section building the app does, and fails unless the
 * three stories come out as the book's chapters.
 */
import { readFileSync } from 'node:fs';
import { buildSentences } from '../src/extraction/sentences';
import { buildSections } from '../src/extraction/sections';
import type { TextItem } from '../src/extraction/types';

const PDF = 'assets/books/three-stories.pdf';
const doc = JSON.parse(readFileSync('design/starter-book/items.json', 'utf8')) as {
  items: TextItem[];
  pageHeight: number;
  pageCount: number;
};

// The outline arrives in the 'cover' message; extractItems keeps only items,
// so it is rebuilt here from the same pdf.js the page uses.
// @ts-ignore -- no types for the legacy build path
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const pdf = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(PDF)) }).promise;
const raw = (await pdf.getOutline()) ?? [];
const outline: Array<{ title: string; page: number; depth: number }> = [];
for (const entry of raw) {
  const dest = typeof entry.dest === 'string' ? await pdf.getDestination(entry.dest) : entry.dest;
  const page = dest ? (await pdf.getPageIndex(dest[0])) + 1 : 1;
  outline.push({ title: entry.title, page, depth: 0 });
}

const sentences = buildSentences(doc.items, doc.pageHeight);
const spoken = sentences.filter((s) => ['heading', 'body', 'note'].includes(s.kind));
const sections = buildSections(sentences, outline);

console.log(`pages ${doc.pageCount}, spoken sentences ${spoken.length}`);
console.log('first spoken:', spoken.slice(0, 4).map((s) => `[${s.kind}] ${s.text}`));
console.log('last spoken:', spoken.at(-1)?.text);
console.log('sections:', sections.map((s) => `${s.title} @${s.index}`));

const want = ['The Gift of the Magi', 'The Last Leaf', 'The Ransom of Red Chief'];
const titles = sections.map((s) => s.title);
if (JSON.stringify(titles) !== JSON.stringify(want)) {
  console.error('FAIL: expected the three stories as chapters, got', titles);
  process.exit(1);
}
console.log('OK: three chapters.');
