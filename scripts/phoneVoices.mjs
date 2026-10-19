/**
 * Which phone voice is which, read off a connected phone.
 *
 *   node --no-warnings scripts/phoneVoices.mjs
 *
 * Open Papervoice's Voices tab on the phone first: listing the phone's voices
 * logs their exact ids. This prints each one beside the label the tab shows
 * ("US English · voice 3"), worked out by the app's own labelling code, so a
 * voice heard in the tab can be named in src/voices/phoneVoiceNames.ts by id.
 */
import { execFileSync } from 'node:child_process';
import { labelPhoneVoices } from '../src/voices/order.ts';
import { PHONE_VOICE_NAMES } from '../src/voices/phoneVoiceNames.ts';

const MARK = '[papervoice] phone voices: ';

const log = execFileSync('adb', ['logcat', '-d', '-s', 'ReactNativeJS:*'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const line = log.split('\n').filter((l) => l.includes(MARK)).pop();

if (!line) {
  console.error('No phone voice list in the log. Open the Voices tab on the phone, then run this again.');
  process.exit(1);
}

const voices = JSON.parse(line.slice(line.indexOf(MARK) + MARK.length).trim());
const labelled = labelPhoneVoices(voices, PHONE_VOICE_NAMES);
const width = Math.max(...labelled.map(({ label }) => label.length));

console.log(`${voices.length} phone voices, in the order the Voices tab lists them:\n`);
for (const { voice, label } of labelled) {
  console.log(`  ${label.padEnd(width)}  ${voice.id}`);
}
