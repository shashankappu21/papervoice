// Puts a voice on the connected device for development, so the edit-compile
// loop never waits on a download. Release builds download voices instead;
// nothing is ever bundled in the app.
//
//   npm run push:voice
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const VOICE = 'vits-piper-en_US-ljspeech-medium';
const URL = `https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/${VOICE}.tar.bz2`;
const PACKAGE = 'com.shappu21.papervoice';
const adb = path.join(process.env.ANDROID_HOME ?? 'G:/Android/Sdk', 'platform-tools', 'adb');

const work = path.join(os.tmpdir(), 'papervoice-voices');
const unpacked = path.join(work, VOICE);
fs.mkdirSync(work, { recursive: true });

if (!fs.existsSync(unpacked)) {
  const archive = path.join(work, `${VOICE}.tar.bz2`);
  if (!fs.existsSync(archive)) {
    console.log(`downloading ${URL}`);
    const response = await fetch(URL);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    fs.writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  }
  console.log('unpacking');
  execFileSync('tar', ['-xjf', archive, '-C', work], { stdio: 'inherit' });
}

const run = (...args) => execFileSync(adb, args, { stdio: 'inherit' });

console.log('pushing to the device');
run('shell', 'rm', '-rf', '/data/local/tmp/ljspeech');
run('push', unpacked, '/data/local/tmp/ljspeech');

// The app's files dir is not world-writable, so the copy runs as the app.
console.log('copying into app storage');
run('shell', `run-as ${PACKAGE} mkdir -p files/models`);
run('shell', `run-as ${PACKAGE} rm -rf files/models/ljspeech`);
run('shell', `run-as ${PACKAGE} cp -r /data/local/tmp/ljspeech files/models/ljspeech`);
run('shell', `run-as ${PACKAGE} ls files/models/ljspeech`);
