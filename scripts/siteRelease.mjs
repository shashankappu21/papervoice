/**
 * Puts the latest release's facts into the website, at deploy time.
 *
 *   node scripts/siteRelease.mjs           write them into site/index.html
 *   node scripts/siteRelease.mjs --check   change nothing; fail if they differ
 *
 * The page shows the APK's version, size, checksum and minimum Android. They
 * come from papervoice.json on the latest release -- written from the APK
 * itself by releaseAssets.mjs -- and are baked into the HTML here, so a visit
 * makes no request to GitHub and the numbers are there with JavaScript off.
 *
 * Refuses, and so fails the deploy, when the stable APK the download buttons
 * point at does not resolve. A page whose main button is a 404 is worse than
 * the page already live.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fillRelease, readRelease, formatSize } from './release/meta.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = path.join(ROOT, 'site', 'index.html');
const LATEST = 'https://github.com/shashankappu21/papervoice/releases/latest/download';
const checkOnly = process.argv.includes('--check');

async function main() {
  const response = await fetch(`${LATEST}/papervoice.json`, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(
      `The latest release has no papervoice.json (HTTP ${response.status}). ` +
        'Run node scripts/releaseAssets.mjs, or the release-assets workflow, first.',
    );
  }
  const meta = await response.json();

  // The file the buttons download, followed through GitHub's redirect to
  // wherever it is stored, and its size checked against the metadata.
  const apk = await fetch(`${LATEST}/${meta.apk.name}`, { method: 'HEAD', redirect: 'follow' });
  if (!apk.ok) throw new Error(`${LATEST}/${meta.apk.name} does not resolve (HTTP ${apk.status}).`);
  const length = Number(apk.headers.get('content-length'));
  if (length && length !== meta.apk.bytes) {
    throw new Error(`${meta.apk.name} is ${length} bytes, but papervoice.json says ${meta.apk.bytes}.`);
  }

  const html = readFileSync(PAGE, 'utf8');
  const filled = fillRelease(html, meta);
  const shown = readRelease(filled);

  console.log(`Latest release ${meta.tag}: ${formatSize(meta.apk.bytes)}, Android ${meta.android ?? '(unknown)'}+, sha256 ${meta.apk.sha256.slice(0, 12)}…`);
  console.log(`  ${meta.apk.name} resolves${length ? `, ${length} bytes` : ''}`);
  if (!meta.android) console.log('  Minimum Android unknown in the metadata; the page keeps the value it has.');

  if (checkOnly) {
    if (filled !== html) {
      console.error(`\nThe page shows ${JSON.stringify(readRelease(html))}, the release says ${JSON.stringify(shown)}.`);
      process.exit(1);
    }
    console.log('  The page matches the release.');
    return;
  }

  if (filled === html) {
    console.log('  The page already matches; nothing written.');
  } else {
    writeFileSync(PAGE, filled);
    console.log(`  Wrote ${JSON.stringify(shown)} into site/index.html.`);
  }
}

main().catch((error) => {
  console.error(`\n${error.message}\n`);
  process.exit(1);
});
