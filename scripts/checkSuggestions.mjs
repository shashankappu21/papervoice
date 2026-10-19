/**
 * What voice the app would suggest for real books.
 *
 *   node --no-warnings scripts/checkSuggestions.mjs book.pdf other.txt ...
 *
 * Runs src/voices/suggest.ts on the first 40 pages of each PDF (extracted the
 * way the app does) or on a plain text file, and prints what it decided and
 * who it would suggest. The rules are simple on purpose; this is how to see
 * whether they still get real books right after a change.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { extractItems } from './extractItems.mjs';
import { profileText, suggestVoices } from '../src/voices/suggest.ts';

const NAMES = {
  'ljspeech-medium': 'Lyra',
  'en_US-kristin-medium': 'Kristin',
  'en_GB-cori-medium': 'Cori',
  'manyvoice-6': 'Michael',
  'manyvoice-10': 'Steve',
  'manyvoice-12': 'Paul',
  'manyvoice-15': 'Martin',
  'system:en-gb-x-gbb-local': 'Oliver',
  'system:en-gb-x-gbd-local': 'Arthur',
  'system:en-us-x-iom-local': 'Ethan',
  'system:en-us-x-iob-local': 'Ava',
};

async function textOf(file) {
  if (!file.toLowerCase().endsWith('.pdf')) return readFileSync(file, 'utf8');
  const doc = await extractItems(file);
  return doc.items
    .filter((item) => item.page <= 40)
    .map((item) => item.text)
    .join(' ');
}

for (const file of process.argv.slice(2)) {
  const profile = profileText(await textOf(file));
  const suggestion = suggestVoices(profile, () => true);
  const who = suggestion ? suggestion.voiceIds.map((id) => NAMES[id] ?? id).join(', ') : '-';
  console.log(
    `${path.basename(file).slice(0, 34).padEnd(34)} ${profile.kind.padEnd(7)} ${String(profile.spelling ?? '-').padEnd(3)} ${who}`,
  );
}
