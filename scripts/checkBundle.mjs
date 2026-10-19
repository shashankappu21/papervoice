/**
 * Says whether the last release build actually contains the app.
 *
 *   node scripts/checkBundle.mjs
 *
 * Reads the source map Gradle leaves beside the JS bundle and counts the
 * project's own files in it. On 2026-10-18 a build succeeded with ZERO of
 * them: node_modules was a junction to another drive, Metro followed it to
 * its real path, and Expo Router found no routes. The APK installed and would
 * have opened blank. Run this after every build, before installing anything.
 *
 * Also checks the feedback address in the bundle matches .env (never printing it).
 */
import { existsSync, readFileSync } from 'node:fs';
import { FEEDBACK_KEY, loadEnv } from './release/env.mjs';

const MAP = 'android/app/build/intermediates/sourcemaps/react/release/index.android.bundle.packager.map';
const BUNDLE = 'android/app/build/generated/assets/react/release/index.android.bundle';

if (!existsSync(MAP)) {
  console.error(`No source map at ${MAP}. Build first: npm run apk -- --fast`);
  process.exit(1);
}

const { sources } = JSON.parse(readFileSync(MAP, 'utf8'));
const own = sources.filter((source) => !source.includes('node_modules'));
const screens = own.filter((source) => /[\\/]app[\\/]/.test(source));

console.log(`${sources.length} modules in the bundle, ${own.length} of them the app's own.`);
console.log(`Screens (${screens.length}):`);
for (const screen of screens) console.log(`  ${screen}`);

// The layout and the library are always there in a working build.
const required = ['_layout.tsx', '(tabs)/index.tsx', 'reader/[bookId].tsx'];
const missing = required.filter((name) => !screens.some((screen) => screen.replace(/\\/g, '/').endsWith(name)));
if (own.length < 50 || missing.length > 0) {
  console.error(`\nFAIL: the bundle is missing the app${missing.length ? ` (${missing.join(', ')})` : ''}. Do not install it.`);
  process.exit(1);
}

// The feedback address is inlined at build time, and Gradle does not count
// .env among the bundle's inputs: a bundle from before the address changed
// looks up to date. So the bundle must carry exactly what .env says now.
loadEnv();
const endpoint = process.env[FEEDBACK_KEY] ?? '';
const bundle = readFileSync(BUNDLE);
if (endpoint && !bundle.includes(Buffer.from(endpoint))) {
  console.error(`\nFAIL: ${FEEDBACK_KEY} is set, but the bundle does not carry it. It is stale; rebuild.`);
  process.exit(1);
}
if (!endpoint && bundle.includes(Buffer.from('script.google.com/macros/'))) {
  console.error(`\nFAIL: ${FEEDBACK_KEY} is not set, but the bundle carries a feedback address. It is stale; rebuild.`);
  process.exit(1);
}
console.log(`Feedback address: ${endpoint ? 'in the bundle, matching .env' : 'not set, and not in the bundle'}.`);

console.log('\nOK: the app is in the bundle.');
