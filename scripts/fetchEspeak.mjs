// Puts the phonemiser data every Piper voice needs into the native module's
// assets, so it ships once with the app rather than with each voice.
//
//   npm run setup:espeak
//
// Only the English data is kept. The full set is 18MB, almost all of it
// dictionaries for languages this app does not read -- ru_dict alone is 8MB --
// and carrying them would nearly halve the install-size budget for nothing.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const VOICE = 'vits-piper-en_US-ljspeech-medium';
const URL = `https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/${VOICE}.tar.bz2`;
const target = path.join('modules', 'sherpa-tts', 'android', 'src', 'main', 'assets', 'espeak-ng-data');

if (fs.existsSync(target)) {
  const files = fs.readdirSync(target).length;
  console.log(`${target} is already present (${files} entries)`);
  process.exit(0);
}

const work = path.join(os.tmpdir(), 'papervoice-espeak');
fs.mkdirSync(work, { recursive: true });

const source = path.join(work, VOICE, 'espeak-ng-data');
if (!fs.existsSync(source)) {
  const archive = path.join(work, `${VOICE}.tar.bz2`);
  if (!fs.existsSync(archive)) {
    console.log(`downloading ${URL}`);
    const response = await fetch(URL);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    fs.writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  }
  // --force-local: GNU tar reads a Windows path like C:\... as a remote host.
  execFileSync('tar', ['--force-local', '-xjf', archive, '-C', work], { stdio: 'inherit' });
}

/** Everything except the dictionaries of languages this app does not read. */
const wanted = (entry) => !entry.endsWith('_dict') || entry === 'en_dict';

let copied = 0;
const copy = (from, to) => {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      copy(path.join(from, entry.name), path.join(to, entry.name));
    } else if (wanted(entry.name)) {
      fs.copyFileSync(path.join(from, entry.name), path.join(to, entry.name));
      copied += 1;
    }
  }
};

copy(source, target);

const size = execFileSync('du', ['-sk', target]).toString().split('\t')[0];
console.log(`wrote ${copied} files to ${target} (${Math.round(Number(size) / 1024)}MB)`);
