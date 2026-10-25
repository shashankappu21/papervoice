import { Directory, Paths } from 'expo-file-system';
import { getSetting, setSetting } from '../db/settings';
import { legacySpeedFolders, phoneAudioFolders } from './audioCache';

/**
 * Which layout the audio cache on this install is in.
 *
 *   1 (or unset)  book/voice/speed/sentence.wav
 *   2             book/voice/sentence.wav
 *   3             the same, with phone-voice audio made before 1.1.1 dropped
 */
const SETTING_CACHE_LAYOUT = 'cache.layout';
const CURRENT_LAYOUT = '3';

/**
 * Deletes the per-speed folders the old cache layout left behind.
 *
 * Once speed left the cache key, nothing reads those folders again: audio is
 * now looked for one level up. Left alone they are dead weight in the cache --
 * a whole book's worth per speed someone ever listened at.
 *
 * Runs once per install, recorded in settings. It is only marked done after it
 * succeeds, so a failure part-way through tries again on the next launch rather
 * than leaving orphans for good; deleting a folder that is already gone is
 * harmless, so trying again is safe.
 *
 * Safe to run alongside playback. The current layout writes files directly into
 * a voice's folder, never into a folder named like `1.00`, so nothing being
 * written now can be caught by this.
 */
export async function migrateAudioCache(): Promise<void> {
  const layout = await getSetting(SETTING_CACHE_LAYOUT);
  if (layout === CURRENT_LAYOUT) return;

  const synth = new Directory(Paths.cache, 'synth');
  let removed = 0;
  if (synth.exists) {
    const root = `${synth.uri.replace(/\/?$/, '/')}`;

    const subfolders = (path: string): string[] => {
      const folder = new Directory(path);
      if (!folder.exists) return [];
      return folder
        .list()
        .filter((entry): entry is Directory => entry instanceof Directory)
        // Trailing slash stripped in case a platform reports one: `1.00/` would
        // not match the pattern, and the folders would be kept without a word.
        .map((entry) => entry.name.replace(/\/$/, ''));
    };

    // Layout 1's per-speed folders, unless this install is already past them.
    // Then, for every install before 1.1.1, the phone-voice audio: some of it
    // was spoken by Google's stand-in voice while the asked-for one was still
    // downloading (see phoneAudioFolders), and it would replay that way.
    const stale = [
      ...(layout === '2' ? [] : legacySpeedFolders(root, subfolders)),
      ...phoneAudioFolders(root, subfolders),
    ];
    for (const path of stale) {
      const folder = new Directory(path);
      if (folder.exists) {
        folder.delete();
        removed += 1;
      }
    }
  }

  await setSetting(SETTING_CACHE_LAYOUT, CURRENT_LAYOUT);
  // Once per install, so one line. A release build cannot be inspected over
  // adb, and this is the only way to confirm it ran on a real device's data.
  console.log(`[papervoice] audio cache migrated to layout ${CURRENT_LAYOUT}: removed ${removed} stale folder(s)`);
}
