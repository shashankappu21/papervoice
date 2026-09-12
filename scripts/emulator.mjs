/**
 * Boots the development emulator and waits until it is actually usable.
 *
 *   npm run emu             boot it, reusing whatever state it had
 *   npm run emu -- --wipe   boot it as a phone nobody has ever opened
 *
 * `--wipe` is the one worth knowing about. Most of what has gone wrong in this
 * app recently only happens on a device in a state that is awkward to get back
 * to: an empty library with no books and no groups, a first launch that offers
 * the tour, a fresh install with no voices downloaded. On a real phone that
 * means uninstalling and reinstalling every time. Here it is a flag.
 *
 * What this is NOT for: anything about speed or sound. The emulator runs on
 * the laptop's own cores with no thermal limit and approximated audio, so a
 * real-time factor measured here is a number about this computer. Voice speed,
 * background playback, headphone and call interruptions, and battery all have
 * to be judged on the phone.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

/** Matches the app's compileSdk, and a Play image so Google's TTS is present. */
const AVD = 'papervoice';

const SDK = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
if (!SDK) {
  console.error('ANDROID_HOME is not set. Point it at your Android SDK.');
  process.exit(1);
}

const exe = (...parts) => path.join(SDK, ...parts) + (process.platform === 'win32' ? '.exe' : '');
const EMULATOR = exe('emulator', 'emulator');
const ADB = exe('platform-tools', 'adb');

if (!existsSync(EMULATOR)) {
  console.error(`No emulator at ${EMULATOR}.`);
  process.exit(1);
}

const adb = (...args) => spawnSync(ADB, args, { encoding: 'utf8' }).stdout ?? '';

/*
 * AVDs live on the drive with room for them.
 *
 * The default is %USERPROFILE%\.android, which is on a C: drive that is 93%
 * full; one emulator with snapshots is comfortably ten gigabytes. Passed
 * explicitly rather than relied on from the environment, so this does the same
 * thing in a shell that has not been restarted since the variable was set.
 */
const env = {
  ...process.env,
  ANDROID_AVD_HOME: process.env.ANDROID_AVD_HOME ?? 'G:\\Android\\avd',
};

const known = spawnSync(EMULATOR, ['-list-avds'], { encoding: 'utf8', env })
  .stdout.split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

if (!known.includes(AVD)) {
  console.error(`No AVD called "${AVD}".${known.length ? ` Found: ${known.join(', ')}` : ''}`);
  console.error('Create it with scripts/createAvd.mjs, or in Android Studio.');
  process.exit(1);
}

// Already up: booting a second copy of the same AVD fails on its lock file.
if (adb('devices').includes('emulator-')) {
  console.log(`${AVD} is already running.`);
  process.exit(0);
}

const wipe = process.argv.includes('--wipe');
console.log(`Booting ${AVD}${wipe ? ', wiped to a first-run state' : ''}...`);

const child = spawn(
  EMULATOR,
  [
    '-avd',
    AVD,
    ...(wipe ? ['-wipe-data'] : []),
    // Without this the window closes when this script exits.
    '-no-boot-anim',
  ],
  { detached: true, stdio: 'ignore', env },
);
child.unref();

/*
 * `wait-for-device` returns as soon as adb can see it, which is well before
 * Android is up -- installing then fails with a message about the package
 * manager not being ready. sys.boot_completed is the property that means the
 * device will actually accept an install.
 */
const started = Date.now();
/*
 * Generous, because the first boot of a freshly created device is a different
 * thing from every boot after it: the Play image has to set itself up, and
 * three minutes was not enough for it here. Later boots restore a snapshot and
 * take seconds, so this limit is only ever reached by a device in trouble.
 */
const deadline = started + 600_000;

const settle = setInterval(() => {
  const booted = adb('shell', 'getprop', 'sys.boot_completed').trim();
  if (booted === '1') {
    clearInterval(settle);
    const seconds = ((Date.now() - started) / 1000).toFixed(0);
    console.log(`\nReady in ${seconds}s.\n`);
    console.log('  npx expo run:android     build and install onto it');
    console.log('  npm run emu -- --wipe    start over from a clean phone\n');
    console.log('Layout, navigation, insets and empty states are faithful here.');
    console.log('Voice speed, audio routing and battery are not -- use the phone.');
    process.exit(0);
  }
  if (Date.now() > deadline) {
    clearInterval(settle);
    console.error('\nStill not booted after 3 minutes. Check the emulator window.');
    process.exit(1);
  }
}, 2000);
