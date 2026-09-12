/**
 * Creates the development emulator, once.
 *
 *   npm run emu:create
 *
 * Committed rather than done by hand in Android Studio so the device everyone
 * tests on is described somewhere readable, and so it can be recreated after it
 * is wiped or moved. The choices below are the ones that matter:
 *
 * - A Play Store image, not plain google_apis. The free tier of this app is
 *   Android's own text-to-speech, and Google's engine is on the Play image.
 *   Testing the free tier against a device that has no Google TTS would be
 *   testing something nobody uses.
 * - API 36, matching compileSdk, so edge-to-edge behaves as it will in release.
 * - x86_64, which runs on the laptop's own cores through WHPX rather than
 *   emulating ARM instruction by instruction. The sherpa AAR ships an x86_64
 *   build, so the neural voices run here natively too.
 * - Stored on G:. The default is under the user profile on a C: drive with 19GB
 *   free, and an emulator with snapshots is comfortably ten.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const AVD = 'papervoice';
const IMAGE = 'system-images;android-36;google_apis_playstore;x86_64';
const DEVICE = 'pixel_7';

const SDK = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
if (!SDK) {
  console.error('ANDROID_HOME is not set.');
  process.exit(1);
}

const AVD_HOME = process.env.ANDROID_AVD_HOME ?? 'G:\\Android\\avd';
const env = { ...process.env, ANDROID_AVD_HOME: AVD_HOME };

const bat = (name) =>
  path.join(SDK, 'cmdline-tools', 'latest', 'bin', name) +
  (process.platform === 'win32' ? '.bat' : '');

/*
 * Arguments are passed as an array with no shell.
 *
 * The image name contains semicolons, and a shell splits on those: the first
 * attempt at this reported "Package system-images not found. Package android-36
 * not found." having torn one name into four.
 */
const run = (file, args) =>
  spawnSync(file, args, { encoding: 'utf8', env, shell: false, input: 'no\n' });

if (!existsSync(path.join(SDK, 'system-images', 'android-36'))) {
  console.error(`The system image is not installed. Run:\n  android sdk install '${IMAGE}'`);
  process.exit(1);
}

console.log(`Creating ${AVD} (${DEVICE}, API 36, x86_64) in ${AVD_HOME}\n`);

const created = run(bat('avdmanager'), [
  'create',
  'avd',
  '--name',
  AVD,
  '--package',
  IMAGE,
  '--device',
  DEVICE,
  '--force',
]);

const config = path.join(AVD_HOME, `${AVD}.avd`, 'config.ini');

/*
 * Judged by whether the device is there, not by the exit code.
 *
 * avdmanager prints a progress bar, asks about a custom hardware profile and
 * returns a status that does not reliably mean what it looks like -- the first
 * run of this reported failure, printed two empty strings, and had created the
 * AVD perfectly well. The file it was supposed to write is the honest test.
 */
if (!existsSync(config)) {
  console.error(created.stdout || '(no output)');
  console.error(created.stderr || '');
  process.exit(1);
}

/*
 * Hardware, set after creation because avdmanager writes a conservative
 * default. 4GB of RAM and an 8GB data partition are sized for this app
 * specifically: a voice is 63-77MB and someone testing properly will hold
 * several of them alongside imported books.
 */
const HARDWARE = {
  'hw.ramSize': '4096',
  'vm.heapSize': '576',
  'disk.dataPartition.size': '10G',
  // A laptop keyboard typing into the emulator, rather than clicking keys.
  'hw.keyboard': 'yes',
  // The free tier speaks through this; without it there is nothing to hear.
  'hw.audioOutput': 'yes',
  'hw.audioInput': 'yes',
  // Host GPU. Off by default, and off means every scroll through a page of
  // text is software-rendered -- which would make this app's main screen feel
  // slow for a reason that has nothing to do with this app.
  'hw.gpu.enabled': 'yes',
  'hw.gpu.mode': 'auto',
  // Boots in seconds after the first time.
  'fastboot.forceColdBoot': 'no',
};

/*
 * Rewritten in place, not appended.
 *
 * avdmanager writes its own value for most of these already, and a second
 * `hw.ramSize=` further down the file does not win -- the first attempt at this
 * appended nothing at all because every key was "already present", and left the
 * device on 2GB with the GPU disabled. Replace what is there, add what is not.
 */
const lines = readFileSync(config, 'utf8').split(/\r?\n/);
const applied = new Set();
const updated = lines.map((line) => {
  const key = line.split('=')[0];
  if (!(key in HARDWARE)) return line;
  applied.add(key);
  return `${key}=${HARDWARE[key]}`;
});
for (const [key, value] of Object.entries(HARDWARE)) {
  if (!applied.has(key)) updated.push(`${key}=${value}`);
}
writeFileSync(config, `${updated.join('\n').replace(/\n+$/, '')}\n`);

console.log(`Done. ${Object.keys(HARDWARE).length} hardware settings applied.\n`);
console.log('  npm run emu             boot it');
console.log('  npm run emu -- --wipe   boot it as a phone nobody has opened\n');
