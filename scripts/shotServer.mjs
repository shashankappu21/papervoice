/**
 * The screenshot page: buttons instead of a command line.
 *
 *   npm run shots        then open http://localhost:5178
 *
 * Taking a set of store screenshots means holding the phone in one hand and
 * driving the app with the other, and a terminal is a bad thing to reach for in
 * that state. This puts a named button next to each shot, shows what has been
 * captured so far, and writes straight into design/raw/ where `npm run assets`
 * looks for them.
 *
 * It has to run locally, because it shells out to adb. There is nothing to
 * install and nothing listens outside this machine.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { OUT, devices, grab, save, sizeOf } from './capture.mjs';

const PORT = 5178;

/**
 * The set being captured, in the order Play shows them.
 *
 * Kept the same as SHOTS in storeAssets.py, which turns these into the finished
 * images. The names are the filenames, so renaming one here means renaming it
 * there.
 */
const SHOTS = [
  { name: '01-library', label: 'Library', hint: 'Three covers, one part-read, mini player showing' },
  { name: '02-reader', label: 'Reader', hint: 'A sentence highlighted, controls visible' },
  { name: '03-voices', label: 'Voices', hint: 'Natural voices at the top, one selected' },
  { name: '04-privacy', label: 'Settings', hint: 'The privacy note in frame' },
  { name: '05-contents', label: 'Contents', hint: 'The sheet open — use a delay' },
  { name: '06-speed', label: 'Speed', hint: 'The sheet open — use a delay' },
];

const json = (response, code, body) => {
  response.writeHead(code, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
};

function state() {
  const attached = devices();
  return {
    device: attached[0] ?? null,
    others: attached.length > 1 ? attached.length - 1 : 0,
    shots: SHOTS.map((shot) => {
      const file = path.join(OUT, `${shot.name}.png`);
      if (!existsSync(file)) return { ...shot, taken: false };
      const { size, mtimeMs } = statSync(file);
      return { ...shot, taken: true, kb: Math.round(size / 1024), at: mtimeMs };
    }),
    extra: existsSync(OUT)
      ? readdirSync(OUT)
          .filter((f) => f.endsWith('.png') && !SHOTS.some((s) => `${s.name}.png` === f))
          .sort()
      : [],
  };
}

const server = createServer((request, response) => {
  const url = new URL(request.url, `http://localhost:${PORT}`);

  if (url.pathname === '/') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return response.end(PAGE);
  }

  if (url.pathname === '/api/state') return json(response, 200, state());

  // Whatever is on the screen right now, not saved anywhere. Used to check the
  // framing before committing to a capture.
  if (url.pathname === '/api/preview') {
    const attached = devices();
    if (!attached.length) return json(response, 503, { error: 'No device attached.' });
    try {
      const png = grab(attached[0]);
      response.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
      return response.end(png);
    } catch (cause) {
      return json(response, 500, { error: String(cause) });
    }
  }

  if (url.pathname === '/api/shot' && request.method === 'POST') {
    const name = url.searchParams.get('name');
    if (!name || !/^[\w-]+$/.test(name)) {
      return json(response, 400, { error: 'A name of letters, numbers and dashes.' });
    }
    const attached = devices();
    if (!attached.length) return json(response, 503, { error: 'No device attached.' });
    try {
      const png = grab(attached[0]);
      const file = save(png, name);
      const { width, height } = sizeOf(png);
      return json(response, 200, {
        file,
        width,
        height,
        kb: Math.round(png.length / 1024),
        device: attached[0],
      });
    } catch (cause) {
      return json(response, 500, { error: String(cause) });
    }
  }

  if (url.pathname === '/api/delete' && request.method === 'POST') {
    const name = url.searchParams.get('name');
    const file = path.join(OUT, `${String(name).replace(/[^\w-]/g, '')}.png`);
    if (existsSync(file)) unlinkSync(file);
    return json(response, 200, { ok: true });
  }

  // Serving from design/raw only, and only .png, since this listens on a port.
  if (url.pathname.startsWith('/file/')) {
    const file = path.join(OUT, path.basename(url.pathname));
    if (!file.endsWith('.png') || !existsSync(file)) {
      response.writeHead(404);
      return response.end('not found');
    }
    response.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
    return response.end(readFileSync(file));
  }

  response.writeHead(404);
  response.end('not found');
});

server.listen(PORT, '127.0.0.1', () => {
  const attached = devices();
  console.log(`\n  Screenshots:  http://localhost:${PORT}`);
  console.log(`  Saving into:  ${OUT}`);
  console.log(
    attached.length ? `  Device:       ${attached[0]}\n` : '\n  No device attached yet.\n',
  );
  const open =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '', `http://localhost:${PORT}`]]
    : process.platform === 'darwin' ? ['open', [`http://localhost:${PORT}`]]
    : ['xdg-open', [`http://localhost:${PORT}`]];
  try {
    spawn(open[0], open[1], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // Opening a browser is a convenience; the address is printed above.
  }
});

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Papervoice screenshots</title>
<style>
  :root {
    --bg: #0d0d0f; --surface: #1c1c20; --line: #2a2a31;
    --text: #f2f2f4; --muted: #a0a0aa; --accent: #8b7cf6; --on: #0d0d0f;
    --good: #4ade80; --bad: #f87171;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font: 15px/1.55 -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 24px 20px 80px; }
  header { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; margin-bottom: 4px; }
  h1 { font-size: 1.5rem; margin: 0; letter-spacing: -0.02em; }
  .device { color: var(--muted); font-size: 0.9rem; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
  .sub { color: var(--muted); font-size: 0.9rem; margin: 0 0 22px; }
  code { background: var(--surface); border: 1px solid var(--line); border-radius: 5px; padding: 1px 6px; font-size: 0.86em; }

  .layout { display: grid; grid-template-columns: 1fr 320px; gap: 26px; align-items: start; }
  @media (max-width: 860px) { .layout { grid-template-columns: 1fr; } }

  .delay { display: flex; gap: 8px; align-items: center; margin-bottom: 18px; flex-wrap: wrap; }
  .delay span { color: var(--muted); font-size: 0.9rem; }
  .pill {
    background: var(--surface); color: var(--text); border: 1px solid var(--line);
    border-radius: 999px; padding: 5px 14px; cursor: pointer; font: inherit; font-size: 0.88rem;
  }
  .pill.on { background: var(--accent); color: var(--on); border-color: var(--accent); font-weight: 600; }

  ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
  li {
    background: var(--surface); border: 1px solid var(--line); border-radius: 12px;
    padding: 12px 14px; display: flex; align-items: center; gap: 14px;
  }
  li.taken { border-color: #2f4636; }
  .thumb {
    width: 38px; height: 76px; border-radius: 5px; background: #000;
    object-fit: cover; object-position: top; flex: none; border: 1px solid var(--line);
  }
  .thumb.empty { display: flex; align-items: center; justify-content: center; color: var(--line); font-size: 20px; }
  .meta { flex: 1; min-width: 0; }
  .meta b { display: block; font-size: 0.98rem; }
  .meta small { color: var(--muted); display: block; font-size: 0.82rem; }
  .status { font-size: 0.78rem; color: var(--good); }
  button.take {
    background: var(--accent); color: var(--on); border: 0; border-radius: 8px;
    padding: 9px 16px; font: inherit; font-weight: 700; cursor: pointer; flex: none;
  }
  button.take:hover { filter: brightness(1.08); }
  button.take:disabled { opacity: 0.45; cursor: default; }
  button.retake { background: var(--surface); color: var(--text); border: 1px solid var(--line); font-weight: 600; }
  button.del {
    background: none; border: 0; color: var(--muted); cursor: pointer; font: inherit;
    font-size: 1.1rem; padding: 2px 6px; flex: none;
  }
  button.del:hover { color: var(--bad); }

  aside h2 { font-size: 0.8rem; letter-spacing: 0.06em; color: var(--muted); margin: 0 0 10px; text-transform: uppercase; }
  .preview { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 12px; }
  .preview img { width: 100%; border-radius: 8px; display: block; background: #000; }
  .preview .none { color: var(--muted); font-size: 0.86rem; text-align: center; padding: 40px 0; }

  .count { position: fixed; inset: 0; background: rgba(13,13,15,0.92); display: none;
           align-items: center; justify-content: center; font-size: 22vw; font-weight: 800; color: var(--accent); }
  .count.on { display: flex; }
  .toast { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%);
           background: var(--surface); border: 1px solid var(--line); border-radius: 10px;
           padding: 10px 18px; font-size: 0.9rem; opacity: 0; transition: opacity .18s; pointer-events: none; }
  .toast.on { opacity: 1; }
  .toast.err { border-color: var(--bad); color: var(--bad); }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Screenshots</h1>
    <span class="device" id="device">connecting…</span>
  </header>
  <p class="sub">Saved into <code>design/raw/</code>, where <code>npm run assets</code> reads them.</p>

  <div class="layout">
    <main>
      <div class="delay">
        <span>Delay before capture</span>
        <button class="pill on" data-delay="0">none</button>
        <button class="pill" data-delay="3">3s</button>
        <button class="pill" data-delay="5">5s</button>
        <button class="pill" id="preview" style="margin-left:auto">Preview screen</button>
      </div>
      <ul id="list"></ul>
    </main>

    <aside>
      <h2>Last capture</h2>
      <div class="preview" id="preview-box"><div class="none">Nothing captured yet</div></div>
    </aside>
  </div>
</div>

<div class="count" id="count"></div>
<div class="toast" id="toast"></div>

<script>
let delay = 0;

const el = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function toast(message, bad) {
  const node = el('toast');
  node.textContent = message;
  node.className = 'toast on' + (bad ? ' err' : '');
  setTimeout(() => { node.className = 'toast'; }, 2600);
}

for (const pill of document.querySelectorAll('[data-delay]')) {
  pill.onclick = () => {
    delay = Number(pill.dataset.delay);
    for (const other of document.querySelectorAll('[data-delay]')) other.classList.toggle('on', other === pill);
  };
}

el('preview').onclick = async () => {
  el('preview-box').innerHTML = '<div class="none">Reading the screen…</div>';
  el('preview-box').innerHTML = '<img src="/api/preview?t=' + Date.now() + '" alt="the screen right now">';
};

async function countdown(seconds) {
  if (!seconds) return;
  const node = el('count');
  node.classList.add('on');
  for (let left = seconds; left > 0; left--) {
    node.textContent = left;
    await sleep(1000);
  }
  node.classList.remove('on');
}

async function take(name) {
  await countdown(delay);
  const response = await fetch('/api/shot?name=' + encodeURIComponent(name), { method: 'POST' });
  const body = await response.json();
  if (!response.ok) return toast(body.error || 'Could not capture', true);
  toast(name + ' — ' + body.width + '×' + body.height + ', ' + body.kb + ' KB');
  el('preview-box').innerHTML = '<img src="/file/' + name + '.png?t=' + Date.now() + '" alt="' + name + '">';
  refresh();
}

async function remove(name) {
  await fetch('/api/delete?name=' + encodeURIComponent(name), { method: 'POST' });
  refresh();
}

async function refresh() {
  const state = await (await fetch('/api/state')).json();

  el('device').innerHTML = state.device
    ? '<span class="dot" style="background:var(--good)"></span>' + state.device +
      (state.others ? ' (+' + state.others + ' more)' : '')
    : '<span class="dot" style="background:var(--bad)"></span>no device attached';

  el('list').innerHTML = state.shots.map((shot) => {
    const thumb = shot.taken
      ? '<img class="thumb" src="/file/' + shot.name + '.png?t=' + shot.at + '" alt="">'
      : '<div class="thumb empty">+</div>';
    return '<li class="' + (shot.taken ? 'taken' : '') + '">' + thumb +
      '<div class="meta"><b>' + shot.label + '</b><small>' + shot.hint + '</small>' +
      (shot.taken ? '<span class="status">captured · ' + shot.kb + ' KB</span>' : '') +
      '</div>' +
      '<button class="take ' + (shot.taken ? 'retake' : '') + '" data-take="' + shot.name + '"' +
      (state.device ? '' : ' disabled') + '>' + (shot.taken ? 'Retake' : 'Take') + '</button>' +
      (shot.taken ? '<button class="del" data-del="' + shot.name + '" title="Delete">×</button>' : '') +
      '</li>';
  }).join('');

  for (const button of document.querySelectorAll('[data-take]')) {
    button.onclick = () => take(button.dataset.take);
  }
  for (const button of document.querySelectorAll('[data-del]')) {
    button.onclick = () => remove(button.dataset.del);
  }
}

refresh();
setInterval(refresh, 4000);
</script>
</body>
</html>`;
