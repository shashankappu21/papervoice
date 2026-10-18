/**
 * Builds the book every new install starts with.
 *
 *   node scripts/starterBook.mjs
 *
 * Three O. Henry stories -- "The Gift of the Magi", "The Last Leaf", "The
 * Ransom of Red Chief" -- from Standard Ebooks' Short Fiction, which is
 * dedicated to the public domain (CC0). Written to
 * assets/books/three-stories.pdf, which the app imports on first launch.
 *
 * Printed by headless Chrome with a document outline, so the app's own
 * outline reading finds the three stories as chapters, exactly as it would in
 * any well-made PDF. The first page is the cover, because the app draws a
 * book's cover from its first page.
 *
 * Run once, by hand; the PDF is committed. Needs Chrome and the network.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets', 'books', 'three-stories.pdf');
const WORK = path.join(ROOT, 'design', 'starter-book');
const SOURCE = 'https://standardebooks.org/ebooks/o-henry/short-fiction/text';
const STORIES = ['the-gift-of-the-magi', 'the-last-leaf', 'the-ransom-of-red-chief'];

const CHROME = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((candidate) => candidate && existsSync(candidate));
if (!CHROME) throw new Error('Chrome not found. Set CHROME to its path.');

/** One story's text, as Standard Ebooks publishes it: an <article> with an h2 title. */
async function story(slug) {
  const response = await fetch(`${SOURCE}/${slug}`, {
    headers: { 'user-agent': 'papervoice starter book build (hi@papervoice.app)' },
  });
  if (!response.ok) throw new Error(`${slug}: HTTP ${response.status}`);
  const html = await response.text();
  const article = /<article[\s\S]*?<\/article>/.exec(html)?.[0];
  if (!article) throw new Error(`${slug}: no <article> in the page`);
  return (
    article
      // Chapter headings become h1, which is what Chrome puts in the outline.
      .replace(/<h2\b[^>]*>/, '<h1>')
      .replace(/<\/h2>/, '</h1>')
      // Their semantic markup means nothing on paper.
      .replace(/\sepub:type="[^"]*"/g, '')
  );
}

const fonts = pathToFileURL(path.join(ROOT, 'site', 'fonts')).href;
const stories = await Promise.all(STORIES.map(story));

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Three Stories by O. Henry</title>
<style>
  @font-face { font-family: 'Playfair'; src: url('${fonts}/playfair.woff2') format('woff2'); font-weight: 400 900; }
  @font-face { font-family: 'Jost'; src: url('${fonts}/jost.woff2') format('woff2'); font-weight: 300 700; }
  @page { size: 148mm 210mm; margin: 18mm 16mm 20mm; }
  html { font-family: Georgia, 'Times New Roman', serif; font-size: 11.5pt; line-height: 1.55; color: #1c1917; }
  body { margin: 0; }
  .cover {
    height: 210mm; margin: -18mm -16mm 0; padding: 0 16mm; box-sizing: border-box;
    background: #4f46e5; color: #faf7f0; display: flex; flex-direction: column; justify-content: center;
    break-after: page;
  }
  .cover p { text-indent: 0; text-align: left; }
  .cover .kicker { font: 600 10pt Jost, sans-serif; letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.8; margin: 0 0 6mm; }
  .cover .title { font: 700 34pt/1.1 Playfair, Georgia, serif; margin: 0 0 8mm; }
  .cover .author { font: 400 15pt Jost, sans-serif; margin: 0; }
  article { break-before: page; }
  h1 { font: 700 20pt/1.2 Playfair, Georgia, serif; margin: 0 0 7mm; }
  p { margin: 0; text-indent: 1.4em; text-align: justify; hyphens: auto; }
  h1 + p { text-indent: 0; }
  .credit { break-before: page; font: 400 10pt/1.5 Jost, sans-serif; color: #57534e; }
</style>
</head>
<body>
<section class="cover">
  <p class="title">Three Stories</p>
  <p class="author">by O. Henry</p>
</section>
${stories.join('\n')}
<p class="credit">These stories are by O. Henry, and are in the public domain. The text is from Standard Ebooks.</p>
</body>
</html>`;

mkdirSync(WORK, { recursive: true });
mkdirSync(path.dirname(OUT), { recursive: true });
const htmlFile = path.join(WORK, 'three-stories.html');
writeFileSync(htmlFile, page);

const profile = path.join(WORK, 'chrome-profile');
execFileSync(CHROME, [
  '--headless=new',
  '--disable-gpu',
  `--user-data-dir=${profile}`,
  '--no-pdf-header-footer',
  '--generate-pdf-document-outline',
  `--print-to-pdf=${OUT}`,
  pathToFileURL(htmlFile).href,
]);
rmSync(profile, { recursive: true, force: true });

const words = stories
  .map((html) => html.replace(/<[^>]+>/g, ' '))
  .join(' ')
  .split(/\s+/)
  .filter(Boolean).length;
console.log(`${path.relative(ROOT, OUT)}: ${(statSync(OUT).size / 1024).toFixed(0)} KB, ${words} words`);
console.log(`About ${Math.round(words / 165)} minutes at a natural reading pace.`);
// The outline is what makes the stories chapters in the app; say if it is missing.
const outline = readFileSync(OUT).toString('latin1').includes('/Outlines');
console.log(outline ? 'Outline: present.' : 'Outline: MISSING -- chapters will not appear.');
