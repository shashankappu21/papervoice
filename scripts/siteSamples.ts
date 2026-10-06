/**
 * Puts real Papervoice recordings on papervoice.app, and their buttons.
 *
 *   npm run site:samples
 *
 * For each voice the app offers, takes a recording and writes it to
 * site/audio/<voice-id>.opus and .m4a, then rewrites the sample buttons in
 * site/index.html to match exactly the voices that have one.
 *
 * Where a recording comes from, first match wins:
 *
 *   design/site-audio/<voice-id>.{wav,flac,m4a,mp3,opus,ogg}
 *       A longer sample supplied by hand -- the ~10-second ones. Every voice
 *       should read the SAME passage, so they can be compared.
 *   assets/samples/<voice-id>.opus
 *       The app's own in-app preview: real output of that voice's model, every
 *       voice reading the same sentence, a few seconds long.
 *
 * Only recordings made by Papervoice's own voices belong here -- never another
 * TTS service, never generated narration. A voice with no recording gets no
 * button rather than a broken one.
 *
 * Needs ffmpeg and ffprobe on PATH.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OFFERED_VOICES } from '../src/voices/catalog';
// @ts-ignore -- plain .mjs
import { HERO_VOICE, renderHero, renderVoices, replaceBlock } from './site/samples.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUPPLIED = path.join(ROOT, 'design', 'site-audio');
const IN_APP = path.join(ROOT, 'assets', 'samples');
const OUT = path.join(ROOT, 'site', 'audio');
const PAGE = path.join(ROOT, 'site', 'index.html');
const SUPPLIED_TYPES = ['wav', 'flac', 'm4a', 'mp3', 'opus', 'ogg'];

/*
 * The sentence every in-app sample reads. Read out of the source rather than
 * imported: samples.ts also require()s the audio files, which only the app's
 * bundler understands.
 */
const SAMPLE_SENTENCE =
  /SAMPLE_SENTENCE\s*=\s*'([^']+)'/.exec(readFileSync(path.join(ROOT, 'src', 'voices', 'samples.ts'), 'utf8'))?.[1] ??
  null;

function source(id: string): { file: string; supplied: boolean } | null {
  for (const type of SUPPLIED_TYPES) {
    const file = path.join(SUPPLIED, `${id}.${type}`);
    if (existsSync(file)) return { file, supplied: true };
  }
  const file = path.join(IN_APP, `${id}.opus`);
  return existsSync(file) ? { file, supplied: false } : null;
}

function duration(file: string): number {
  return Number(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {
      encoding: 'utf8',
    }).trim(),
  );
}

function encode(input: string, output: string, codec: string[]): void {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', input, '-vn', '-ac', '1', ...codec, output]);
}

mkdirSync(OUT, { recursive: true });
const samples: Array<{ id: string; name: string; accent: string; gender: string; seconds: number; supplied: boolean }> = [];
const missing: string[] = [];

for (const voice of OFFERED_VOICES) {
  const found = source(voice.id);
  if (!found) {
    missing.push(`${voice.name} (${voice.id})`);
    continue;
  }

  const opus = path.join(OUT, `${voice.id}.opus`);
  const m4a = path.join(OUT, `${voice.id}.m4a`);

  // The app's own Opus is used as it is: re-encoding would only lose quality.
  if (found.file.endsWith('.opus')) copyFileSync(found.file, opus);
  else encode(found.file, opus, ['-c:a', 'libopus', '-b:a', '32k', '-application', 'voip']);
  // For browsers that do not play Opus -- older Safari, chiefly.
  encode(found.file, m4a, ['-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart']);

  samples.push({
    id: voice.id,
    name: voice.name,
    accent: voice.accent,
    gender: voice.gender,
    seconds: duration(opus),
    supplied: found.supplied,
  });
}

// Recordings for voices no longer offered would be served for nothing.
const keep = new Set(samples.flatMap((s) => [`${s.id}.opus`, `${s.id}.m4a`]));
for (const file of readdirSync(OUT)) if (!keep.has(file)) rmSync(path.join(OUT, file));

// Every supplied recording should read one passage; the in-app ones read one
// sentence. A mix of the two is still a fair comparison only if every voice
// in the mix reads the same words, which this cannot check -- so it says so.
const supplied = samples.filter((s) => s.supplied);
const sentence = supplied.length === 0 ? SAMPLE_SENTENCE : null;

let html = readFileSync(PAGE, 'utf8');
html = replaceBlock(html, 'hero', renderHero(samples.find((s) => s.id === HERO_VOICE) ?? null));
html = replaceBlock(html, 'voices', renderVoices(samples, { sentence }));
writeFileSync(PAGE, html);

let bytes = 0;
for (const file of readdirSync(OUT)) bytes += readFileSync(path.join(OUT, file)).length;

console.log(`\n${samples.length} voice sample(s) in site/audio (${Math.round(bytes / 1024)} KB, fetched only when pressed):\n`);
for (const s of samples) {
  console.log(`  ${s.name.padEnd(10)} ${s.seconds.toFixed(1).padStart(5)} s  ${s.supplied ? 'supplied recording' : 'in-app sample'}`);
}
if (missing.length) console.log(`\nNo recording, so no button: ${missing.join(', ')}`);
if (supplied.length && supplied.length < samples.length) {
  console.log(`\nMixed: ${supplied.length} supplied, ${samples.length - supplied.length} in-app. They read different words, so the`);
  console.log('page no longer quotes one shared line. Supply every voice, reading one passage, to compare fairly.');
}
console.log(`\nHero: ${samples.some((s) => s.id === HERO_VOICE) ? 'Hear Lyra shown' : 'no Lyra recording, so no Hear Lyra button'}`);
