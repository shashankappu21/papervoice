// Writes a TextItem[] fixture for a PDF:
//   node scripts/extractFixture.mjs book.pdf fixtures/local/book.items.json [maxPages]
import fs from 'node:fs';
import { extractItems } from './extractItems.mjs';

const [pdfPath, outPath, maxPagesArg] = process.argv.slice(2);
const maxPages = Number(maxPagesArg || '0');

const doc = await extractItems(pdfPath);
const kept = maxPages ? doc.items.filter((it) => it.page <= maxPages) : doc.items;
fs.writeFileSync(outPath, JSON.stringify({
  pageHeight: doc.pageHeight,
  pageCount: maxPages ? Math.min(maxPages, doc.pageCount) : doc.pageCount,
  items: kept,
}));
console.log(`pages=${doc.pageCount} kept=${maxPages || doc.pageCount} items=${kept.length} height=${doc.pageHeight}`);
