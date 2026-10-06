import { describe, expect, it } from 'vitest';
import {
  audioPath,
  bookDirectory,
  evict,
  isLegacySpeedFolder,
  legacySpeedFolders,
  type CachedFile,
} from '../src/tts/audioCache';

const VOICE = { bookId: 7, voiceId: 'kitten-nano-3' };

describe('where a sentence"s audio lives', () => {
  it('keeps each book and voice apart', () => {
    const a = audioPath('/c/', { ...VOICE, index: 4 });
    const otherBook = audioPath('/c/', { ...VOICE, bookId: 8, index: 4 });
    const otherVoice = audioPath('/c/', { ...VOICE, voiceId: 'ljspeech-medium', index: 4 });

    expect(new Set([a, otherBook, otherVoice]).size).toBe(3);
  });

  it('has no speed in it, so changing speed reuses the audio already made', () => {
    // The listener's speed is applied by the player; the audio is identical at
    // every speed, so a speed in the name only ever forced a re-synthesis.
    expect(audioPath('/c/', { ...VOICE, index: 4 })).toBe('/c/7/kitten-nano-3/4.wav');
  });

  it('gives the same sentence the same name every time', () => {
    // The whole point: audio made yesterday is found again today rather than
    // being made a second time.
    expect(audioPath('/c/', { ...VOICE, index: 4 })).toBe(
      audioPath('/c/', { ...VOICE, index: 4 }),
    );
  });

  it('survives a voice id with characters a path cannot hold', () => {
    const path = audioPath('/c/', { ...VOICE, voiceId: 'system:en-us-x-iom#local', index: 1 });
    expect(path).not.toContain(':');
    expect(path).not.toContain('#');
  });

  it('names a book"s folder so everything under it can be dropped at once', () => {
    const dir = bookDirectory('/c/', 7);
    expect(audioPath('/c/', { ...VOICE, index: 4 }).startsWith(dir)).toBe(true);
  });
});

describe('the folders the old per-speed layout left behind', () => {
  it('recognises the speed folders the old layout wrote', () => {
    for (const name of ['1.00', '1.25', '0.50', '3.00', '10.00']) {
      expect(isLegacySpeedFolder(name)).toBe(true);
    }
  });

  it('leaves alone anything the current layout makes', () => {
    // A book folder, voice folders, and a sentence file's name.
    for (const name of ['7', 'kitten-nano-3', 'system_en-us-x-iom-local', 'en_US-lessac', '4.wav', '1.0', '1.000']) {
      expect(isLegacySpeedFolder(name)).toBe(false);
    }
  });

  it('finds them two levels down, under each book and voice, and nowhere else', () => {
    const tree: Record<string, string[]> = {
      '/c/': ['7', '8'],
      '/c/7/': ['kitten-nano-3', 'lyra'],
      '/c/7/kitten-nano-3/': ['1.00', '1.50'],
      '/c/7/lyra/': [],
      '/c/8/': ['lyra'],
      '/c/8/lyra/': ['2.00'],
    };
    const found = legacySpeedFolders('/c/', (path) => tree[path] ?? []);

    expect(found.sort()).toEqual([
      '/c/7/kitten-nano-3/1.00',
      '/c/7/kitten-nano-3/1.50',
      '/c/8/lyra/2.00',
    ]);
  });

  it('finds nothing in a cache already in the new layout', () => {
    const tree: Record<string, string[]> = {
      '/c/': ['7'],
      '/c/7/': ['lyra'],
      '/c/7/lyra/': [],
    };
    expect(legacySpeedFolders('/c/', (path) => tree[path] ?? [])).toEqual([]);
  });
});

const file = (path: string, bytes: number, usedAt: number): CachedFile => ({
  path,
  bytes,
  usedAt,
});

describe('evict', () => {
  it('keeps everything while the cache is under budget', () => {
    const files = [file('a', 10, 1), file('b', 10, 2)];
    expect(evict(files, { budgetBytes: 100, pinned: [] })).toEqual([]);
  });

  it('drops the least recently used first', () => {
    const files = [file('old', 50, 1), file('new', 50, 9), file('middle', 50, 5)];
    expect(evict(files, { budgetBytes: 100, pinned: [] })).toEqual(['old']);
  });

  it('drops as many as it takes to get under budget', () => {
    const files = [file('a', 50, 1), file('b', 50, 2), file('c', 50, 3)];
    expect(evict(files, { budgetBytes: 60, pinned: [] })).toEqual(['a', 'b']);
  });

  it('never drops a pinned book, however old', () => {
    // A book someone downloaded in full is not a cache. Evicting it would
    // silently undo something they asked for and waited on.
    const files = [file('/c/9/v/1/0.wav', 500, 1), file('/c/3/v/1/0.wav', 50, 9)];
    const dropped = evict(files, { budgetBytes: 100, pinned: ['/c/9/'] });
    expect(dropped).toEqual(['/c/3/v/1/0.wav']);
  });

  it('gives up rather than evicting pinned files it cannot free', () => {
    const files = [file('/c/9/v/1/0.wav', 500, 1)];
    expect(evict(files, { budgetBytes: 10, pinned: ['/c/9/'] })).toEqual([]);
  });

  it('handles an empty cache', () => {
    expect(evict([], { budgetBytes: 100, pinned: [] })).toEqual([]);
  });
});
