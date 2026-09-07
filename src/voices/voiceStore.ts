import type { VoiceMeta } from './catalog';

/**
 * The parts of the device this store touches, injected so the logic can be
 * tested without a filesystem or a network.
 */
export interface VoiceFiles {
  exists(path: string): boolean;
  remove(path: string): void;
  rename(from: string, to: string): void;
  checksum(path: string): Promise<string>;
}

export type Download = (
  url: string,
  to: string,
  onProgress?: (fraction: number) => void,
) => Promise<void>;

export interface VoiceStoreOptions {
  files: VoiceFiles;
  download: Download;
  /** Directory the voices live under, without a trailing slash. */
  root: string;
}

export interface VoiceStore {
  /** Where each of a voice's files lives, whether or not it needs them all. */
  paths(voice: VoiceMeta): { model: string; tokens: string; voices: string; lexicon: string };
  isInstalled(voice: VoiceMeta): boolean;
  install(voice: VoiceMeta, onProgress?: (fraction: number) => void): Promise<void>;
  remove(voice: VoiceMeta): void;
}

/**
 * Installs and removes voices.
 *
 * A download lands on a `.part` file and is only given its real name once the
 * bytes are all there and the checksum agrees. A voice interrupted halfway
 * therefore reads as not installed, rather than as a model that loads and
 * produces noise -- which is the failure someone would report as "the app
 * broke", with no way to see why.
 */
export function createVoiceStore({ files, download, root }: VoiceStoreOptions): VoiceStore {
  const paths = (voice: VoiceMeta) => ({
    model: `${root}/${voice.id}/model.onnx`,
    tokens: `${root}/${voice.id}/tokens.txt`,
    voices: `${root}/${voice.id}/voices.bin`,
    lexicon: `${root}/${voice.id}/lexicon.txt`,
  });

  /** Every file this particular voice cannot speak without. */
  const required = (voice: VoiceMeta): string[] => {
    const { model, tokens, voices, lexicon } = paths(voice);
    return [
      model,
      tokens,
      ...(voice.voicesUrl ? [voices] : []),
      ...(voice.lexiconUrl ? [lexicon] : []),
    ];
  };

  const isInstalled = (voice: VoiceMeta): boolean =>
    required(voice).every((path) => files.exists(path));

  return {
    paths,
    isInstalled,

    async install(voice, onProgress) {
      const { model, tokens, voices, lexicon } = paths(voice);

      // Weighted by size, so the bar moves at the speed of the download rather
      // than jumping when a small file finishes.
      const parts: Array<{ url: string; target: string; share: number }> = [
        { url: voice.modelUrl, target: model, share: voice.voicesUrl ? 0.7 : 0.98 },
        ...(voice.voicesUrl ? [{ url: voice.voicesUrl, target: voices, share: 0.28 }] : []),
        ...(voice.lexiconUrl ? [{ url: voice.lexiconUrl, target: lexicon, share: 0.01 }] : []),
        { url: voice.tokensUrl, target: tokens, share: 0.01 },
      ];

      let done = 0;
      for (const { url, target, share } of parts) {
        const partial = `${target}.part`;
        const base = done;
        await download(url, partial, (fraction) => onProgress?.(base + fraction * share));

        // An empty checksum means one has not been recorded yet, which is the
        // case while a voice is still being evaluated. Skipping the check is
        // deliberate and visible, rather than a comparison that always passes.
        if (target === model && voice.modelSha256 !== '') {
          const actual = await files.checksum(partial);
          if (actual !== voice.modelSha256) {
            files.remove(partial);
            throw new Error(
              `The downloaded voice failed its checksum, so it was discarded. ` +
                `Expected ${voice.modelSha256}, got ${actual}.`,
            );
          }
        }

        files.rename(partial, target);
        done += share;
        onProgress?.(done);
      }

      onProgress?.(1);
    },

    remove(voice) {
      const { model, tokens, voices, lexicon } = paths(voice);
      for (const path of [model, tokens, voices, lexicon]) {
        files.remove(path);
        files.remove(`${path}.part`);
      }
    },
  };
}
