/**
 * Answers "can these two models share a phonemiser?" by looking, not arguing.
 *
 *   npm run phonemes -- compare ljspeech-medium kitten-nano-0
 *   npm run phonemes -- compare ljspeech-medium https://.../mv2.onnx.json
 *   npm run phonemes -- cover  kitten-nano-0 "ðə ˈʤʌʤ"
 *
 * `compare` diffs two models' token maps. `cover` takes phonemes a phonemiser
 * actually produced and reports which of them the model has no token for.
 *
 * Both questions have been answered wrongly in this project by reasoning about
 * them. `cover` with the reference's own output would have shown the Kitten
 * fault -- U+02A4 against "dʒ" -- in one line, instead of an explanation that
 * sounded right for two sessions. See src/voices/tokens.ts.
 */

import { VOICES } from '../src/voices/catalog';
import { coverage, describe, diffTokenMaps, parsePhonemeIdMap, parseTokens } from '../src/voices/tokens';

/**
 * Resolves a voice id, or a URL to either a tokens.txt or a Piper config.
 *
 * URLs are accepted so a model that is not in the catalog can be checked
 * before it is added -- which is the moment the answer is worth most.
 */
async function tokensFor(target: string): Promise<Map<number, string>> {
  const voice = VOICES.find((candidate) => candidate.id === target);
  const url = voice ? voice.tokensUrl : target;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  const body = await response.text();

  if (url.endsWith('.json')) {
    const config = JSON.parse(body) as { phoneme_id_map?: Record<string, number[]> };
    if (!config.phoneme_id_map) throw new Error(`${url} has no phoneme_id_map`);
    return parsePhonemeIdMap(config.phoneme_id_map);
  }
  return parseTokens(body);
}

async function compare(a: string, b: string) {
  const [left, right] = await Promise.all([tokensFor(a), tokensFor(b)]);
  const diff = diffTokenMaps(left, right);

  console.log(`\n${a}  ${left.size} tokens`);
  console.log(`${b}  ${right.size} tokens\n`);

  if (diff.identical) {
    console.log('Identical. One phonemiser serves both, and a speaker id is the only');
    console.log('difference between loading them.');
    return;
  }

  if (diff.conflicting.length) {
    console.log(`${diff.conflicting.length} ids hold DIFFERENT symbols -- these two cannot`);
    console.log('share a token stream; the same number means different sounds:');
    for (const row of diff.conflicting.slice(0, 20)) {
      console.log(`  ${String(row.id).padStart(4)}  ${describe(row.a)}  vs  ${describe(row.b)}`);
    }
  }
  for (const [label, ids, map] of [
    [`only in ${a}`, diff.onlyInA, left],
    [`only in ${b}`, diff.onlyInB, right],
  ] as const) {
    if (!ids.length) continue;
    console.log(`\n${ids.length} ${label}:`);
    console.log(`  ${ids.slice(0, 30).map((id) => describe(map.get(id)!)).join(' ')}`);
  }
}

async function cover(target: string, phonemes: string) {
  const tokens = await tokensFor(target);
  const result = coverage(phonemes, tokens);

  console.log(`\n${target}: ${result.covered}/${result.total} distinct symbols mapped`);
  if (!result.unmappable.length) {
    console.log('Every symbol has a token. If it still sounds wrong, the fault is the');
    console.log('weights or the phonemiser choosing wrong sounds -- not the mapping.');
    return;
  }
  console.log(`\n${result.unmappable.length} symbols the model has NO token for --`);
  console.log('these are dropped, and dropped phonemes are heard as slurred words:');
  for (const symbol of result.unmappable) console.log(`  ${describe(symbol)}`);
}

const [command, ...rest] = process.argv.slice(2);

const run =
  command === 'compare' && rest.length === 2
    ? compare(rest[0], rest[1])
    : command === 'cover' && rest.length >= 2
      ? cover(rest[0], rest.slice(1).join(' '))
      : Promise.reject(
          new Error(
            'usage:\n' +
              '  npm run phonemes -- compare <voiceId|url> <voiceId|url>\n' +
              '  npm run phonemes -- cover <voiceId|url> "<phonemes>"',
          ),
        );

run.catch((cause: Error) => {
  console.error(cause.message);
  process.exit(1);
});
