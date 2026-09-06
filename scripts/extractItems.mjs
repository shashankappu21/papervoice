// Runs the real extractor page script (src/extraction/extractorHtml.ts) under
// Node with the browser bits stubbed, so anything built on desktop comes from
// the same code that runs in the WebView on the device.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function extractItems(pdfPath, root = process.cwd()) {
  const ts = fs.readFileSync(path.join(root, 'src/extraction/extractorHtml.ts'), 'utf8');
  const script = ts.slice(ts.indexOf('<script>') + '<script>'.length, ts.indexOf('</script>'));

  const messages = [];
  globalThis.window = {
    ReactNativeWebView: { postMessage: (s) => messages.push(JSON.parse(s)) },
  };
  globalThis.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');
  globalThis.XMLHttpRequest = class {
    open() {}
    send() { this.responseText = ''; queueMicrotask(() => this.onload()); }
  };
  const dist = path.join(root, 'node_modules/pdfjs-dist/legacy/build');
  let call = 0;
  globalThis.Blob = class { constructor(parts) { this.parts = parts; } };
  globalThis.URL.createObjectURL = () =>
    pathToFileURL(path.join(dist, call++ === 0 ? 'pdf.min.mjs' : 'pdf.worker.min.mjs')).href;

  const extract = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('page never became ready')), 30000);
    const poll = setInterval(() => {
      const failed = messages.find((m) => m.type === 'error');
      if (failed) { clearInterval(poll); clearTimeout(timer); reject(new Error(failed.message)); }
      if (globalThis.window.extract) { clearInterval(poll); clearTimeout(timer); resolve(globalThis.window.extract); }
    }, 20);
    new Function(script)();
  });

  await extract(fs.readFileSync(pdfPath).toString('base64'));
  const items = messages.find((m) => m.type === 'items');
  if (!items) throw new Error(messages.find((m) => m.type === 'error')?.message ?? 'no items posted');
  return { items: items.items, pageHeight: items.pageHeight, pageCount: items.pageCount };
}
