import { describe, it, expect, vi } from 'vitest';
import { createVoiceStore, type VoiceFiles } from '../src/voices/voiceStore';
import type { VoiceMeta } from '../src/voices/catalog';

const voice: VoiceMeta = {
  id: 'test-voice',
  family: 'vits',
  name: 'Test',
  accent: 'US',
  gender: 'female',
  sizeBytes: 4,
  modelUrl: 'https://example.invalid/model.onnx',
  tokensUrl: 'https://example.invalid/tokens.txt',
  modelSha256: 'abc123',
  defaultRate: 1,
  licence: 'test',
};

/** An in-memory stand-in for the device's storage. */
function fakeFiles(): VoiceFiles & { present: Set<string> } {
  const present = new Set<string>();
  return {
    present,
    exists: (path) => present.has(path),
    remove: (path) => {
      present.delete(path);
      present.delete(`${path}.part`);
    },
    rename: (from, to) => {
      present.delete(from);
      present.add(to);
    },
    checksum: async () => 'abc123',
  };
}

const downloader = (files: { present: Set<string> }) =>
  vi.fn(async (_url: string, to: string) => {
    files.present.add(to);
  });

describe('voiceStore', () => {
  it('reports a voice installed only when every file it needs is there', async () => {
    const files = fakeFiles();
    const store = createVoiceStore({ files, download: downloader(files), root: '/v' });

    files.present.add('/v/test-voice/model.onnx');
    expect(store.isInstalled(voice)).toBe(false);

    files.present.add('/v/test-voice/tokens.txt');
    expect(store.isInstalled(voice)).toBe(true);
  });

  it('downloads to a part file and renames it once complete', async () => {
    const files = fakeFiles();
    const download = downloader(files);
    const store = createVoiceStore({ files, download, root: '/v' });

    await store.install(voice);

    // An interrupted download must never leave something that loads and makes
    // noise: the real name only appears when the bytes are all there.
    expect(download.mock.calls.map((call) => call[1])).toEqual([
      '/v/test-voice/model.onnx.part',
      '/v/test-voice/tokens.txt.part',
    ]);
    expect(store.isInstalled(voice)).toBe(true);
  });

  it('throws and cleans up when the checksum does not match', async () => {
    const files = fakeFiles();
    files.checksum = async () => 'something-else';
    const store = createVoiceStore({ files, download: downloader(files), root: '/v' });

    await expect(store.install(voice)).rejects.toThrow(/checksum/i);
    expect(store.isInstalled(voice)).toBe(false);
  });

  it('reports progress across both files as one download', async () => {
    const files = fakeFiles();
    const seen: number[] = [];
    const store = createVoiceStore({
      files,
      root: '/v',
      download: vi.fn(async (_url: string, to: string, onProgress?: (f: number) => void) => {
        onProgress?.(0.5);
        onProgress?.(1);
        files.present.add(to);
      }),
    });

    await store.install(voice, (fraction) => seen.push(fraction));

    expect(seen[0]).toBeGreaterThan(0);
    expect(seen[seen.length - 1]).toBe(1);
    // Progress only ever moves forwards, or a bar jumps backwards mid-download.
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });

  it('downloads the extra file a kokoro voice needs', async () => {
    // Kokoro keeps its speaker embeddings in a separate file, so a voice that
    // has the model and tokens but not that one cannot speak at all.
    const kokoro: VoiceMeta = {
      ...voice,
      id: 'kokoro',
      family: 'kokoro',
      voicesUrl: 'https://example.invalid/voices.bin',
    };
    const files = fakeFiles();
    const store = createVoiceStore({ files, download: downloader(files), root: '/v' });

    files.present.add('/v/kokoro/model.onnx');
    files.present.add('/v/kokoro/tokens.txt');
    expect(store.isInstalled(kokoro)).toBe(false);

    await store.install(kokoro);
    expect(store.isInstalled(kokoro)).toBe(true);
  });

  it('lets several voices share one download', async () => {
    // A model that holds many speakers is downloaded once and appears as one
    // voice per speaker. Keying files by the voice id would fetch the same
    // model again for every speaker in it.
    const first: VoiceMeta = { ...voice, id: 'pack-a', packId: 'pack', speakerId: 0 };
    const second: VoiceMeta = { ...voice, id: 'pack-b', packId: 'pack', speakerId: 1 };
    const files = fakeFiles();
    const store = createVoiceStore({ files, download: downloader(files), root: '/v' });

    await store.install(first);

    expect(store.paths(second).model).toBe(store.paths(first).model);
    expect(store.isInstalled(second)).toBe(true);
  });

  it('removing a voice makes it uninstalled again', async () => {
    const files = fakeFiles();
    const store = createVoiceStore({ files, download: downloader(files), root: '/v' });

    await store.install(voice);
    store.remove(voice);

    expect(store.isInstalled(voice)).toBe(false);
  });
});
