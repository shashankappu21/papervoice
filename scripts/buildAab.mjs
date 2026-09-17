/**
 * Builds the release bundle, the one Play wants.
 *
 *   npm run aab
 *
 * An AAB is not something you can install; it is what Play generates the
 * installable pieces from. It carries both ABIs and every density, and each
 * phone downloads only its own -- which is why the file this produces is
 * larger than the APK while the download it leads to is smaller.
 *
 * The one difference in how it is built is packaging. The APK compresses its
 * native libraries, because someone sideloading it downloads the APK itself
 * and 37 MB of onnxruntime compresses to 15. Play does that compression on the
 * way down regardless and wants the libraries stored plainly so it can, so the
 * bundle overrides the flag back.
 */
import { spawn } from 'node:child_process';
import { statSync, existsSync } from 'node:fs';
import path from 'node:path';

const AAB = 'android/app/build/outputs/bundle/release/app-release.aab';

// Without the key the build quietly signs with the debug one, which Play
// rejects -- or worse, accepts into a draft that then has to be discarded.
if (!existsSync('keys/keystore.properties')) {
  console.error('\nNo keys/keystore.properties: this would be signed with the debug key.\n');
  process.exit(1);
}

const started = Date.now();
console.log('\nBuilding the release bundle for arm64-v8a,armeabi-v7a\n');

// `:app:bundleRelease`, not the bare task, for the same reason buildApk.mjs
// scopes its own: asking the sherpa-tts module to bundle itself fails.
const gradle = spawn(
  path.join('android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'),
  [
    '-p',
    'android',
    ':app:bundleRelease',
    '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a',
    '-Pexpo.useLegacyPackaging=false',
    '--console=plain',
  ],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);

gradle.on('exit', (code) => {
  const minutes = ((Date.now() - started) / 60000).toFixed(1);

  if (code !== 0) {
    console.error(`\nBuild failed after ${minutes} minutes.\n`);
    process.exit(code ?? 1);
  }

  if (!existsSync(AAB)) {
    console.error(`\nGradle succeeded but ${AAB} is not there.\n`);
    process.exit(1);
  }

  const megabytes = (statSync(AAB).size / 1_048_576).toFixed(1);
  console.log(
    `\nDone in ${minutes} minutes.\n\n  ${AAB}\n  ${megabytes} MB` +
      `\n\n  That is the upload, not the download: Play splits it per ABI and` +
      `\n  per density, so a phone fetches roughly half of it.\n`,
  );
});
