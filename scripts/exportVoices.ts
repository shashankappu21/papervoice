/**
 * Writes the catalog out as JSON for the sample generator.
 *
 * The catalog is TypeScript and the generator is Python, so the two meet in a
 * file. Generated rather than kept by hand: a voice added to the catalog and
 * forgotten here would silently ship with no sample.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { OFFERED_VOICES } from '../src/voices/catalog';

const rows = OFFERED_VOICES.map((voice) => ({
  id: voice.id,
  name: voice.name,
  family: voice.family,
  packId: voice.packId ?? voice.id,
  speakerId: voice.speakerId ?? 0,
  model: voice.modelUrl,
  tokens: voice.tokensUrl,
  voices: voice.voicesUrl ?? null,
  rate: voice.defaultRate,
}));

const out = path.join(__dirname, 'voices.json');
writeFileSync(out, JSON.stringify(rows, null, 2) + '\n');
console.log(`wrote ${rows.length} voices to ${out}`);
