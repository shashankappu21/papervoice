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
  paths(voice: VoiceMeta): { model: string; tokens: string };
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
  });

  const isInstalled = (voice: VoiceMeta): boolean => {
    const { model, tokens } = paths(voice);
    return files.exists(model) && files.exists(tokens);
  };

  return {
    paths,
    isInstalled,

    async install(voice, onProgress) {
      const { model, tokens } = paths(voice);

      // The model is almost all of the download; weighting by that keeps the
      // bar honest rather than jumping at the end.
      const parts: Array<{ url: string; target: string; share: number }> = [
        { url: voice.modelUrl, target: model, share: 0.99 },
        { url: voice.tokensUrl, target: tokens, share: 0.01 },
      ];

      let done = 0;
      for (const { url, target, share } of parts) {
        const partial = `${target}.part`;
        const base = done;
        await download(url, partial, (fraction) => onProgress?.(base + fraction * share));

        if (target === model) {
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
      const { model, tokens } = paths(voice);
      for (const path of [model, tokens]) {
        files.remove(path);
        files.remove(`${path}.part`);
      }
    },
  };
}
