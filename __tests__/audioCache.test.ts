import { describe, expect, it } from 'vitest';
import { audioPath, bookDirectory, evict, type CachedFile } from '../src/tts/audioCache';

const VOICE = { bookId: 7, voiceId: 'kitten-nano-3', rate: 1.2 };

describe('where a sentence"s audio lives', () => {
  it('keeps each book, voice and speed apart', () => {
    const a = audioPath('/c/', { ...VOICE, index: 4 });
    const otherBook = audioPath('/c/', { ...VOICE, bookId: 8, index: 4 });
    const otherVoice = audioPath('/c/', { ...VOICE, voiceId: 'ljspeech-medium', index: 4 });
    const otherRate = audioPath('/c/', { ...VOICE, rate: 1.5, index: 4 });

    expect(new Set([a, otherBook, otherVoice, otherRate]).size).toBe(4);
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

  it('does not let a speed of 1 and 1.0 be two different folders', () => {
    expect(audioPath('/c/', { ...VOICE, rate: 1, index: 0 })).toBe(
      audioPath('/c/', { ...VOICE, rate: 1.0, index: 0 }),
    );
  });

  it('names a book"s folder so everything under it can be dropped at once', () => {
    const dir = bookDirectory('/c/', 7);
    expect(audioPath('/c/', { ...VOICE, index: 4 }).startsWith(dir)).toBe(true);
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
