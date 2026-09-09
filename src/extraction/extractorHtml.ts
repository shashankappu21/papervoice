/**
 * The page that runs inside the hidden extraction WebView.
 *
 * It is a string rather than a file because Metro cannot bundle an HTML file
 * together with its sibling scripts. The page is loaded with a `file://` base
 * URL pointing at the staged pdf.js directory (see `pdfjsAssets.ts`), reads the
 * two vendored scripts from there over XHR — `fetch` refuses `file:` URLs in
 * Chromium, XHR is what `allowFileAccessFromFileURLs` enables — and turns them
 * into blob URLs, which sidesteps both the CORS ban on `file://` module imports
 * and the one on `file://` workers.
 */
export const EXTRACTOR_HTML = `<!doctype html>
<meta charset="utf-8">
<body>
<script>
var post = function (msg) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); };
var describe = function (e) { return String(e && e.message ? e.message : e); };

function readText(name) {
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', name);
    xhr.onload = function () { resolve(xhr.responseText); };
    xhr.onerror = function () { reject(new Error('Could not read ' + name)); };
    xhr.send();
  });
}

function blobUrl(source) {
  return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
}

function extractWith(pdfjsLib) {
  return async function (base64) {
    try {
      var binary = atob(base64);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      var pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      var items = [];
      var pageHeight = 792;
      var cover = null;

      // Page one, drawn as it looks. For a book that is the jacket; for a
      // scanned document it is the scan; for a bare text PDF it is the title
      // page. All three are the right picture, and none needs a special case.
      try {
        var first = await pdf.getPage(1);
        var natural = first.getViewport({ scale: 1 });
        var scale = Math.min(2, 420 / natural.width);
        var viewport = first.getViewport({ scale: scale });
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        var context = canvas.getContext('2d');
        // White behind it: a PDF page has no background of its own, and
        // without this every cover comes out with black where the paper is.
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await first.render({ canvasContext: context, viewport: viewport }).promise;
        cover = canvas.toDataURL('image/jpeg', 0.72).split(',')[1];
        first.cleanup();
      } catch (e) {
        // A cover is decoration. Losing it must never lose the book.
        cover = null;
      }

      for (var p = 1; p <= pdf.numPages; p++) {
        var page = await pdf.getPage(p);
        pageHeight = page.getViewport({ scale: 1 }).height;
        var content = await page.getTextContent();

        var pageItems = content.items
          .filter(function (it) { return it.str && it.str.trim().length > 0; })
          .map(function (it) {
            return {
              text: it.str,
              page: p,
              x: it.transform[4],
              y: it.transform[5],
              width: it.width,
              height: it.height,
              fontSize: Math.abs(it.transform[3]) || it.height,
            };
          });

        // Reading order: top-to-bottom, then left-to-right. y is measured from
        // the page bottom, so descending y moves down the page.
        pageItems.sort(function (a, b) {
          return Math.abs(a.y - b.y) > 2 ? b.y - a.y : a.x - b.x;
        });
        for (var j = 0; j < pageItems.length; j++) items.push(pageItems[j]);

        page.cleanup();
        post({ type: 'progress', page: p, total: pdf.numPages });
      }

      post({
        type: 'items',
        items: items,
        pageHeight: pageHeight,
        pageCount: pdf.numPages,
        cover: cover,
      });
    } catch (e) {
      post({ type: 'error', message: describe(e) });
    }
  };
}

(async function boot() {
  try {
    var sources = await Promise.all([readText('pdf.min.mjs'), readText('pdf.worker.min.mjs')]);
    var pdfjsLib = await import(blobUrl(sources[0]));
    var workerUrl = blobUrl(sources[1]);
    try {
      pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(workerUrl, { type: 'module' });
    } catch (e) {
      // Falls back to pdf.js's main-thread path. Slower, but this WebView is
      // offscreen so there is no UI to block.
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
    }
    window.extract = extractWith(pdfjsLib);
    post({ type: 'ready' });
  } catch (e) {
    post({ type: 'error', message: 'pdf.js failed to load: ' + describe(e) });
  }
})();
</script>
</body>`;
