/**
 * Builds the APK people will actually download, and publishes it.
 *
 *   npm run release                 build, sign, and stage the files locally
 *   npm run release -- --publish    the same, then publish a GitHub release
 *
 * Wraps the ordinary release build with the things that are easy to forget and
 * awkward to correct afterwards: that versionCode went up, that the right key
 * signed it, and what its checksum is.
 *
 * Every release carries the same files, staged in design/release/<version>/:
 *
 *   papervoice-X.Y.Z.apk          the versioned APK; old links keep working
 *   papervoice.apk                the same bytes, the name papervoice.app links to
 *   papervoice.apk.sha256         checksums, in sha256sum's format
 *   papervoice-X.Y.Z.apk.sha256
 *   papervoice.json               version, size, checksum, minimum Android
 *
 * --publish creates the release as a draft, uploads all of them, and only then
 * publishes it. That order is what keeps the website's button working: the
 * moment a release becomes "latest", releases/latest/download/papervoice.apk
 * has to be on it, and a draft is never latest. The release-assets workflow is
 * the backstop for a release made by hand.
 *
 * Built and signed here, never in CI: the signing key stays on this machine.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createDraft, publishDraft, releaseExists, token, uploadAsset } from './release/github.mjs';
import { assetSet, formatSize } from './release/meta.mjs';
import { apkFacts } from './release/apk.mjs';

const APK = 'android/app/build/outputs/apk/release/app-release.apk';
const app = JSON.parse(readFileSync('app.json', 'utf8')).expo;
const version = app.version;
const versionCode = app.android?.versionCode;
const tag = `v${version}`;
const publish = process.argv.includes('--publish');

function fail(...lines) {
  console.error(`\n${lines.join('\n')}\n`);
  process.exit(1);
}

if (!versionCode) {
  fail(
    'app.json has no android.versionCode. Android treats a build',
    'without one as unversioned and refuses to install it over another.',
  );
}

console.log(`\nPapervoice ${version} (versionCode ${versionCode})${publish ? ` -- will publish ${tag}` : ''}\n`);

/*
 * Signed with the project's own key, deliberately.
 *
 * Play was given this same key -- "export and upload a key from a Java
 * keystore" -- so a build from the store updates an install that came from
 * the website, because the signatures match. A Google-generated key would have
 * left those two permanently unable to update each other.
 *
 * Which makes keys/papervoice-release.keystore the single file in this
 * project that cannot be replaced. It is ignored by git, so it is not in a
 * commit anywhere. Keep a copy somewhere else.
 */
if (!existsSync('keys/keystore.properties')) {
  fail(
    'No keys/keystore.properties: this would be signed with the debug',
    'key, which cannot be updated by a properly signed build later.',
  );
}

// Checked before a half-hour build, not after it.
if (publish) {
  if (!token()) fail('No GitHub token: sign Git in to github.com, or set GITHUB_TOKEN.');
  if (await releaseExists(tag)) {
    fail(`${tag} already exists. Bump "version" (and android.versionCode) in app.json first.`);
  }
  execFileSync('git', ['fetch', '--quiet', 'origin', 'main']);
  const unpushed = execFileSync('git', ['rev-list', '--count', 'origin/main..HEAD'], { encoding: 'utf8' }).trim();
  if (unpushed !== '0') {
    fail(`${unpushed} commit(s) are not on origin/main. The release is tagged on HEAD, so push first.`);
  }
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

if (gradle.status !== 0 || !existsSync(APK)) fail('Build failed.');

const bytes = readFileSync(APK);
const facts = apkFacts(bytes);
if (facts?.versionCode && facts.versionCode !== versionCode) {
  fail(`The APK says versionCode ${facts.versionCode}, app.json says ${versionCode}. Run prebuild, then build again.`);
}

const set = assetSet({ version, tag, apkBytes: bytes, minSdk: facts?.minSdk ?? null, versionCode });
const staged = path.join('design', 'release', version);
mkdirSync(staged, { recursive: true });
writeFileSync(path.join(staged, set.versionedName), bytes);
for (const file of set.files) writeFileSync(path.join(staged, file.name), file.bytes);

const android = set.metadata.android ? `Android ${set.metadata.android} and newer` : 'Android (minimum unknown)';
const notes = [
  `Papervoice ${version}.`,
  '',
  `${android}. Works on both 64-bit and 32-bit phones.`,
  '',
  '**Check the download before installing:**',
  '',
  '```',
  'sha256sum papervoice.apk',
  `${set.hash}`,
  '```',
  '',
  `\`papervoice.apk\` and \`${set.versionedName}\` are the same file. The checksum confirms that the file you`,
  'downloaded matches the one published here.',
  '',
  'Android may warn about installing an app from outside Google Play. Read what it says before',
  'continuing. Installation help: https://papervoice.app/#install',
  '',
  '---',
  '',
  'Free and open source. [papervoice.app](https://papervoice.app)',
].join('\n');
writeFileSync(path.join(staged, 'release-notes.md'), notes);

console.log(`\n${'-'.repeat(64)}`);
console.log(`  ${set.versionedName}   ${formatSize(bytes.length)}   ${android}`);
console.log(`  sha256  ${set.hash}`);
console.log(`  Staged in ${staged}, with the stable copy, checksums and release notes.`);
console.log(`${'-'.repeat(64)}`);

if (!publish) {
  console.log('\nTo publish: npm run release -- --publish');
  console.log('Or create the release by hand with the versioned APK; the release-assets');
  console.log('workflow then adds the rest.\n');
  console.log('Before the next release, bump android.versionCode in app.json.');
  console.log('Android refuses to install a build whose versionCode is not higher.\n');
  process.exit(0);
}

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const draft = await createDraft({ tag, target: head, name: `Papervoice ${version}`, body: notes });
console.log(`\nDraft ${tag} created. Uploading...`);

const uploads = [
  { name: set.versionedName, bytes, type: 'application/vnd.android.package-archive' },
  ...set.files,
];
for (const file of uploads) {
  await uploadAsset(draft, file.name, file.bytes, file.type);
  console.log(`  ${file.name}`);
}

const published = await publishDraft(draft);
console.log(`\nPublished ${published.html_url}`);
console.log('The website picks the new version up when its deploy next runs.');
console.log('\nBefore the next release, bump android.versionCode in app.json.\n');
