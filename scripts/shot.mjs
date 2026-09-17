/**
 * Captures the screen of an attached phone or emulator, into design/raw/.
 *
 *   npm run shot -- 01-library         saves design/raw/01-library.png
 *   npm run shot -- 02-reader --in 5   waits five seconds first
 *   npm run shot                       lists what is already captured
 *
 * There is a version of this with buttons -- `npm run shots` -- which is
 * easier when taking a whole set, because you are holding the phone.
 *
 * It exists because the alternative is pressing the phone's own screenshot
 * buttons and then fishing the files out of /sdcard by timestamp, which is how
 * the last set was made and why they arrived named Screenshot_1789645656.png
 * with no way to tell which was which.
 *
 * `--in` is for anything that only looks right while you are touching it: a
 * sheet mid-slide, a pressed button, a menu. Start the timer, then set the
 * screen up with your hands free.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { OUT, devices, grab, save, sizeOf } from './capture.mjs';

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--'));
const delay = Number(args[args.indexOf('--in') + 1]) || 0;

const attached = devices();
if (attached.length === 0) {
  console.error('\nNo device. Plug the phone in, or start the emulator.\n');
  process.exit(1);
}

if (!name) {
  console.log(`\nDevice: ${attached[0]}${attached.length > 1 ? `  (of ${attached.length})` : ''}`);
  console.log(`\nIn ${OUT}:\n`);
  if (existsSync(OUT)) {
    for (const file of readdirSync(OUT).sort()) {
      const { size } = statSync(path.join(OUT, file));
      console.log(`  ${String(Math.round(size / 1024)).padStart(5)} KB  ${file}`);
    }
  }
  console.log('\nTo capture:  npm run shot -- 01-library');
  console.log('With buttons: npm run shots\n');
  process.exit(0);
}

if (delay > 0) {
  console.log(`\nCapturing in ${delay}s — set the screen up now.`);
  for (let left = delay; left > 0; left--) {
    process.stdout.write(`  ${left}\r`);
    // Synchronous on purpose: this is a countdown a person is watching, and
    // there is nothing else for the script to be doing meanwhile.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
}

const png = grab(attached[0]);
const file = save(png, name);
const { width, height } = sizeOf(png);

console.log(`\n  ${file}`);
console.log(`  ${width}x${height}, ${Math.round(png.length / 1024)} KB, from ${attached[0]}\n`);
