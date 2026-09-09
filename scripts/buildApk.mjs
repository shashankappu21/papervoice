/**
 * Builds the release APK, showing what it is doing.
 *
 *   npm run apk              both ABIs, the one to send to people
 *   npm run apk -- --fast    arm64 only, for testing a release build quickly
 *
 * Gradle's output goes straight to the terminal rather than into a file, so a
 * forty-minute build is something you can watch rather than something you have
 * to guess about.
 */
import { spawn } from 'node:child_process';
import { statSync, existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Both, so the APK installs on older and cheaper phones too.
 *
 * Development builds only ever compile arm64 -- see plugins/withDevAbi -- so
 * the first build that includes armeabi-v7a compiles it from cold and takes
 * far longer than the ones after it.
 */
const ABIS = process.argv.includes('--fast') ? 'arm64-v8a' : 'arm64-v8a,armeabi-v7a';

const APK = 'android/app/build/outputs/apk/release/app-release.apk';

const started = Date.now();
console.log(`\nBuilding the release APK for ${ABIS}\n`);

/*
 * `:app:assembleRelease`, not `assembleRelease`. The bare task runs for every
 * subproject, and asking the sherpa-tts module to assemble itself means asking
 * it to package itself as an AAR -- which fails, because an AAR cannot contain
 * the local sherpa-onnx AAR it wraps. Only ever visible on a release build.
 */
const gradle = spawn(
  path.join('android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'),
  ['-p', 'android', ':app:assembleRelease', `-PreactNativeArchitectures=${ABIS}`, '--console=plain'],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);

gradle.on('exit', (code) => {
  const minutes = ((Date.now() - started) / 60000).toFixed(1);

  if (code !== 0) {
    console.error(`\nBuild failed after ${minutes} minutes.\n`);
    process.exit(code ?? 1);
  }

  if (!existsSync(APK)) {
    // Gradle can report success without producing what was asked for, which is
    // worth saying out loud rather than leaving to be discovered later.
    console.error(`\nGradle succeeded but ${APK} is not there.\n`);
    process.exit(1);
  }

  const megabytes = (statSync(APK).size / 1_048_576).toFixed(1);
  console.log(`\nDone in ${minutes} minutes.\n\n  ${APK}\n  ${megabytes} MB\n`);
});
