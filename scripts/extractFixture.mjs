// Runs the real extractor page script (src/extraction/extractorHtml.ts) under
// Node with the browser bits stubbed, so the fixture is produced by the same
// code that ships in the WebView.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const pdfPath = process.argv[2];
const outPath = process.argv[3];
const maxPages = Number(process.argv[4] || "0");

const ts = fs.readFileSync(path.join(root, 'src/extraction/extractorHtml.ts'), 'utf8');
const script = ts.slice(ts.indexOf('<script>') + '<script>'.length, ts.indexOf('</script>'));

const messages = [];
globalThis.window = {
  ReactNativeWebView: { postMessage: (s) => messages.push(JSON.parse(s)) },
};
globalThis.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');
globalThis.XMLHttpRequest = class {
  open(_m, _url) {}
  send() { this.responseText = ''; queueMicrotask(() => this.onload()); }
};
// The page turns the vendored sources into blob URLs; in Node we hand back the
// on-disk copies instead, which is the same module text.
const dist = path.join(root, 'node_modules/pdfjs-dist/legacy/build');
let blobCall = 0;
globalThis.Blob = class { constructor(parts) { this.parts = parts; } };
globalThis.URL.createObjectURL = () =>
  pathToFileURL(path.join(dist, blobCall++ === 0 ? 'pdf.min.mjs' : 'pdf.worker.min.mjs')).href;

const body = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('page never became ready')), 30000);
  const poll = setInterval(() => {
    const err = messages.find((m) => m.type === 'error');
    if (err) { clearInterval(poll); clearTimeout(timer); reject(new Error(err.message)); }
    if (globalThis.window.extract) { clearInterval(poll); clearTimeout(timer); resolve(globalThis.window.extract); }
  }, 20);
  new Function(script)();
});

const base64 = fs.readFileSync(pdfPath).toString('base64');
await body(base64);

const items = messages.find((m) => m.type === 'items');
if (!items) throw new Error(messages.find((m) => m.type === 'error')?.message ?? 'no items posted');

const kept = maxPages ? items.items.filter((it) => it.page <= maxPages) : items.items;
fs.writeFileSync(outPath, JSON.stringify({
  pageHeight: items.pageHeight,
  pageCount: maxPages ? Math.min(maxPages, items.pageCount) : items.pageCount,
  items: kept,
}));
console.log(`pages=${items.pageCount} kept=${maxPages || items.pageCount} items=${kept.length} height=${items.pageHeight}`);
