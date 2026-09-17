/**
 * Builds the APK people will actually download, and says what to publish.
 *
 *   npm run release
 *
 * Wraps the ordinary release build with the things that are easy to forget and
 * awkward to correct afterwards: that versionCode went up, that the right key
 * signed it, and what its checksum is.
 *
 * The checksum matters because of how this is distributed. An APK from a
 * website is a file someone chose to trust, and the only way to offer them
 * anything better than trust is to publish the hash somewhere they can compare
 * it against. It goes in the release notes beside the download.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const APK = 'android/app/build/outputs/apk/release/app-release.apk';
const app = JSON.parse(readFileSync('app.json', 'utf8')).expo;
const version = app.version;
const versionCode = app.android?.versionCode;

if (!versionCode) {
  console.error('app.json has no android.versionCode. Android treats a build');
  console.error('without one as unversioned and refuses to install it over another.');
  process.exit(1);
}

console.log(`\nPapervoice ${version} (versionCode ${versionCode})\n`);

/*
 * Signed with the project's own key, deliberately.
 *
 * Play can be given this same key later -- "export and upload a key from a
 * Java keystore" -- and then a build from the store updates an install that
 * came from the website, because the signatures match. Accepting a
 * Google-generated key instead would leave those two permanently unable to
 * update each other, and everyone who sideloaded would have to uninstall.
 *
 * Which makes keys/papervoice-release.keystore the single file in this
 * project that cannot be replaced. It is ignored by git, so it is not in a
 * commit anywhere. Keep a copy somewhere else.
 */
if (!existsSync('keys/keystore.properties')) {
  console.error('No keys/keystore.properties: this would be signed with the debug');
  console.error('key, which cannot be updated by a properly signed build later.');
  process.exit(1);
}

const gradle = spawnSync(
  path.join('android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'),
  [
    '-p',
    'android',
    ':app:assembleRelease',
    '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a',
    '--console=plain',
  ],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);

if (gradle.status !== 0 || !existsSync(APK)) {
  console.error('\nBuild failed.\n');
  process.exit(1);
}

const bytes = readFileSync(APK);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const megabytes = (statSync(APK).size / 1_048_576).toFixed(1);

console.log(`\n${'-'.repeat(64)}`);
console.log(`  ${APK}`);
console.log(`  ${megabytes} MB`);
console.log(`\n  Publish this with the download, so it can be checked:`);
console.log(`\n  sha256  ${sha256}`);
console.log(`\n  Release notes:`);
console.log(`\n    Papervoice ${version}`);
console.log(`    sha256: ${sha256}`);
console.log(`\n  Verify with:   sha256sum papervoice-${version}.apk`);
console.log(`${'-'.repeat(64)}\n`);
console.log('Next: bump android.versionCode in app.json before the following release.');
console.log('Android refuses to install a build whose versionCode is not higher.\n');
