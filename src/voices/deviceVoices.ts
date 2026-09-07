import { Directory, File, Paths } from 'expo-file-system';
import { SherpaTts } from '../../modules/sherpa-tts';
import { createVoiceStore, type VoiceStore } from './voiceStore';
import { VOICES, type VoiceMeta } from './catalog';

/**
 * The voice store as it runs on the device.
 *
 * The logic it wraps is tested against fakes; this file is the part that has to
 * be tried on a phone, so it is kept as thin as it can be.
 */

/** Plain filesystem paths, because sherpa-onnx opens them itself. */
const plain = (uri: string) => uri.replace(/^file:\/\//, '').replace(/\/$/, '');

const voicesRoot = (): string => {
  const dir = new Directory(Paths.document, 'voices');
  dir.create({ intermediates: true, idempotent: true });
  return plain(dir.uri);
};

let store: VoiceStore | null = null;

export function voiceStore(): VoiceStore {
  store ??= createVoiceStore({
    root: voicesRoot(),
    files: {
      exists: (path) => new File(`file://${path}`).exists,
      remove: (path) => {
        const file = new File(`file://${path}`);
        if (file.exists) file.delete();
      },
      rename: (from, to) => {
        new File(`file://${from}`).move(new File(`file://${to}`));
      },
      // The native module hashes the file, which avoids reading 63MB through
      // JavaScript only to throw the bytes away.
      checksum: (path) => SherpaTts.sha256(path),
    },
    download: async (url, to, onProgress) => {
      const target = new File(`file://${to}`);
      // idempotent: create() is not mkdir -p and throws when the directory is
      // already there, which it is for every voice after the first attempt.
      target.parentDirectory.create({ intermediates: true, idempotent: true });
      if (target.exists) target.delete();

      const task = File.createDownloadTask(url, target, {
        onProgress: ({ bytesWritten, totalBytes }) => {
          if (totalBytes > 0) onProgress?.(bytesWritten / totalBytes);
        },
      });
      await task.downloadAsync();
    },
  });
  return store;
}

/**
 * Where the phonemiser data lives once unpacked. Every voice shares it, so it
 * is installed once and its path is the same for all of them.
 */
export async function espeakDataDir(): Promise<string> {
  return SherpaTts.installEspeakData(`${plain(Paths.document.uri)}/espeak-ng-data`);
}

/** Everything a loaded voice needs, once it is installed. */
export async function voiceLoadPaths(voice: VoiceMeta) {
  const paths = voiceStore().paths(voice);
  return { ...paths, dataDir: await espeakDataDir() };
}

/**
 * Deletes voices the app no longer offers.
 *
 * A voice dropped from the catalog leaves its files behind with nothing in the
 * app that can reach them -- in Kokoro's case 167MB of a voice that turned out
 * to be too slow to use. Reclaiming that should not require reinstalling.
 */
export function removeUnknownVoices(): number {
  const dir = new Directory(Paths.document, 'voices');
  if (!dir.exists) return 0;

  const known = new Set(VOICES.map((voice) => voice.packId ?? voice.id));
  let removed = 0;

  for (const entry of dir.list()) {
    if (entry instanceof Directory && !known.has(entry.name)) {
      entry.delete();
      removed += 1;
    }
  }
  return removed;
}
