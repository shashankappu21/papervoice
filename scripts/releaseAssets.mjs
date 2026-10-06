/**
 * Gives a published release the files the website depends on.
 *
 *   node scripts/releaseAssets.mjs              the latest release
 *   node scripts/releaseAssets.mjs v1.0.0       a particular one
 *   node scripts/releaseAssets.mjs --check      report only, change nothing
 *
 * papervoice.app links to
 *
 *   https://github.com/shashankappu21/papervoice/releases/latest/download/papervoice.apk
 *
 * which only works if every release carries an APK under that exact name. A
 * release is made with a versioned file -- papervoice-1.0.0.apk -- so the
 * versioned links people already have keep working, and this adds, from that
 * same file:
 *
 *   papervoice.apk              a byte-for-byte copy, under the stable name
 *   papervoice.apk.sha256       its checksum, in sha256sum's format
 *   papervoice-X.Y.Z.apk.sha256 the same, for the versioned name
 *   papervoice.json             version, size, checksum and minimum Android,
 *                               which the website's deploy reads
 *
 * The copy is made from the published asset itself, never from a local build,
 * and is checked against GitHub's own digest of that asset before anything is
 * uploaded. Nothing is signed here and no key is needed: the APK is copied,
 * not rebuilt. Runs on a developer's machine and in Actions alike.
 *
 * Idempotent. A stable APK already present is verified rather than replaced;
 * one that differs from the versioned APK is a hard error, because the two
 * names must never serve different files.
 */
import { STABLE_APK, deleteAsset, digestOf, download, getRelease, uploadAsset } from './release/github.mjs';
import { assetSet, sha256 } from './release/meta.mjs';
import { apkFacts } from './release/apk.mjs';

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const tag = args.find((arg) => !arg.startsWith('--'));

async function main() {
  const release = await getRelease(tag);
  if (release.draft) throw new Error(`${release.tag_name} is a draft; publish it first.`);

  const version = release.tag_name.replace(/^v/, '');
  const versionedName = `papervoice-${version}.apk`;
  const find = (name) => release.assets.find((asset) => asset.name === name);

  const versioned = find(versionedName);
  if (!versioned) {
    throw new Error(`${release.tag_name} has no ${versionedName}. Attach the signed APK under that name first.`);
  }

  console.log(`${release.tag_name}: ${versionedName}, ${versioned.size} bytes`);

  const bytes = await download(versioned);
  const hash = sha256(bytes);
  const recorded = digestOf(versioned);
  if (bytes.length !== versioned.size) throw new Error(`downloaded ${bytes.length} bytes, GitHub lists ${versioned.size}`);
  if (recorded && recorded !== hash) throw new Error(`downloaded sha256 ${hash} does not match GitHub's ${recorded}`);
  console.log(`  sha256 ${hash}${recorded ? ' (matches GitHub\'s digest)' : ''}`);

  const facts = apkFacts(bytes);
  const { metadata, files: wanted } = assetSet({
    version,
    tag: release.tag_name,
    apkBytes: bytes,
    minSdk: facts?.minSdk ?? null,
    versionCode: facts?.versionCode ?? null,
    publishedAt: release.published_at,
  });
  console.log(`  minimum Android ${metadata.android ?? 'unknown (no aapt2)'}${metadata.minSdk ? ` (API ${metadata.minSdk})` : ''}`);

  let changed = 0;
  for (const file of wanted) {
    const existing = find(file.name);
    const expected = sha256(file.bytes);

    if (existing) {
      const theirs = digestOf(existing) ?? sha256(await download(existing));
      if (theirs === expected) {
        console.log(`  ok       ${file.name}`);
        continue;
      }
      if (file.name === STABLE_APK) {
        // Two names serving different builds is the one thing this must not
        // allow, and replacing a published binary silently is not this
        // script's call to make.
        throw new Error(`${STABLE_APK} on ${release.tag_name} differs from ${versionedName}. Resolve by hand.`);
      }
      // A checksum or metadata file that is out of date is simply rewritten.
      if (checkOnly) {
        console.log(`  STALE    ${file.name}`);
        changed += 1;
        continue;
      }
      await deleteAsset(existing);
    }

    if (checkOnly) {
      console.log(`  MISSING  ${file.name}`);
      changed += 1;
      continue;
    }

    const uploaded = await uploadAsset(release, file.name, file.bytes, file.type);
    const landed = digestOf(uploaded);
    if (landed && landed !== expected) throw new Error(`${file.name} uploaded with sha256 ${landed}, expected ${expected}`);
    console.log(`  added    ${file.name} (${file.bytes.length} bytes)`);
    changed += 1;
  }

  if (checkOnly && changed > 0) {
    console.log(`\n${changed} file(s) missing or stale. Run without --check to add them.`);
    process.exitCode = 1;
  } else {
    console.log(changed ? `\nDone: ${changed} file(s) written.` : '\nNothing to do.');
  }
}

main().catch((error) => {
  console.error(`\n${error.message}\n`);
  process.exit(1);
});
