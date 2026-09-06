/**
 * Extracts a PDF and writes out what the reader would actually say, for a human
 * to check:
 *
 *   npm run inspect -- "book.pdf" [outDir]
 *
 * Produces two files next to each other: a `.sentences.txt` laid out for
 * reading, and a `.sentences.json` holding the exact objects the app works with.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { TextItem } from '../src/extraction/types';
import { buildSentences } from '../src/extraction/sentences';
import { speakable } from '../src/tts/speakable';
import { chunk } from '../src/tts/chunk';
import { buildLines } from '../src/extraction/lines';
import { buildBlocks } from '../src/extraction/blocks';

const pdfPath = process.argv[2];
const outDir = process.argv[3] ?? 'out';
if (!pdfPath) throw new Error('usage: npm run inspect -- "<file.pdf>" [outDir]');

// pdf.js is loaded by dynamic import inside a `new Function`, which only works
// under plain Node -- this file runs under vite-node, so extraction is done in a
// child process.
const scratch = path.join(os.tmpdir(), `papervoice-${process.pid}.items.json`);
execFileSync(process.execPath, ['scripts/extractFixture.mjs', pdfPath, scratch], {
  stdio: ['ignore', 'ignore', 'inherit'],
});
const doc = JSON.parse(fs.readFileSync(scratch, 'utf8')) as {
  items: TextItem[];
  pageHeight: number;
  pageCount: number;
};
fs.rmSync(scratch, { force: true });
const lines = buildLines(doc.items);
const blocks = buildBlocks(lines, doc.pageHeight);
const sentences = buildSentences(doc.items, doc.pageHeight);

fs.mkdirSync(outDir, { recursive: true });
const stem = path.join(outDir, path.basename(pdfPath).replace(/\.pdf$/i, ''));

fs.writeFileSync(`${stem}.sentences.json`, JSON.stringify(sentences, null, 2));

const pageOf = (i: number) => sentences[i].boxes[0]?.page ?? 0;
const dropped = blocks.filter((b) => b.kind === 'furniture');
const chars = (s: string) => s.replace(/\s/g, '').length;
const totalChars = doc.items.reduce((n, i) => n + chars(i.text), 0);
const keptChars = sentences.reduce((n, s) => n + chars(s.text), 0);

const out: string[] = [];
out.push(`${path.basename(pdfPath)}`);
out.push(`${doc.pageCount} pages, ${doc.items.length} text items, ${lines.length} lines, ${blocks.length} blocks`);
out.push(`${sentences.length} sentences: ` +
  (['heading', 'body', 'note', 'header', 'footer'] as const)
    .map((k) => `${sentences.filter((s) => s.kind === k).length} ${k}`)
    .join(', '));
out.push(`spoken aloud: ${sentences.filter((s) => s.kind !== 'header' && s.kind !== 'footer').length}`);
out.push(`coverage: ${((keptChars / totalChars) * 100).toFixed(1)}% of characters kept`);
out.push('');
out.push(`DROPPED AS PAGE FURNITURE (${dropped.length} blocks, never read aloud)`);
for (const block of dropped.slice(0, 40)) out.push(`  p${block.page}  ${JSON.stringify(block.text.slice(0, 90))}`);
if (dropped.length > 40) out.push(`  ... and ${dropped.length - 40} more`);
out.push('');
/** How long an utterance may be before it is cut into separate jobs. */
const CHUNK_LIMIT = 300;

const rewritten = sentences.filter(
  (s) => s.kind !== 'header' && s.kind !== 'footer' && speakable(s.text) !== s.text,
);
out.push(`REWRITTEN FOR SPEECH (${rewritten.length} sentences)`);
for (const s of rewritten.slice(0, 25)) {
  out.push(`  page  ${s.text}`);
  out.push(`  says  ${speakable(s.text)}`);
}
if (rewritten.length > 25) out.push(`  ... and ${rewritten.length - 25} more`);
out.push('');

const split = sentences.filter(
  (s) => s.kind !== 'header' && s.kind !== 'footer' && chunk(speakable(s.text), CHUNK_LIMIT).length > 1,
);
out.push(`CUT INTO SEVERAL UTTERANCES (${split.length} sentences over ${CHUNK_LIMIT} characters)`);
for (const s of split.slice(0, 10)) {
  out.push(`  #${s.index} (${s.text.length} chars) -> ${chunk(speakable(s.text), CHUNK_LIMIT).length} pieces`);
}
out.push('');

out.push('SENTENCES, in the order they will be spoken');
out.push('='.repeat(72));
for (const s of sentences) {
  const tag = s.kind === 'body' ? '         ' : `[${s.kind}]`.padEnd(9);
  out.push(`${String(s.index).padStart(5)}  p${String(pageOf(s.index)).padStart(3)}  ${tag}${s.text}`);
  const spoken = speakable(s.text);
  if (spoken !== s.text && s.kind !== 'header' && s.kind !== 'footer') {
    out.push(`${' '.repeat(21)}says: ${spoken}`);
  }
}
fs.writeFileSync(`${stem}.sentences.txt`, out.join('\n') + '\n');

console.log(out.slice(0, 6).join('\n'));
console.log(`\nwrote ${stem}.sentences.txt`);
console.log(`wrote ${stem}.sentences.json`);
