import { describe, it, expect, vi } from 'vitest';
import { createSynthQueue } from '../src/tts/synthQueue';
import type { Sentence } from '../src/extraction/types';

const sentences: Sentence[] = Array.from({ length: 50 }, (_, i) => ({
  index: i,
  kind: 'body',
  text: `Sentence number ${i}.`,
  boxes: [],
}));

const fakeSynth = () =>
  vi.fn(async (_sentence: Sentence, outPath: string) => {
    await new Promise((r) => setTimeout(r, 1));
    return { path: outPath, durationSec: 2, rtf: 0.15 };
  });

describe('createSynthQueue', () => {
  it('synthesizes exactly `lookahead` sentences after start', async () => {
    const synthesize = fakeSynth();
    const q = createSynthQueue({ sentences, synthesize, lookahead: 5, cacheDir: '/c/' });
    await q.start(0);
    await q.drain();
    expect(synthesize).toHaveBeenCalledTimes(5);
  });

  it('reports each finished sentence through onReady in order', async () => {
    const ready: number[] = [];
    const q = createSynthQueue({
      sentences,
      synthesize: fakeSynth(),
      lookahead: 3,
      cacheDir: '/c/',
      onReady: (i) => ready.push(i),
    });
    await q.start(0);
    await q.drain();
    expect(ready).toEqual([0, 1, 2]);
  });

  it('advances the window when the current index moves', async () => {
    const synthesize = fakeSynth();
    const q = createSynthQueue({ sentences, synthesize, lookahead: 3, cacheDir: '/c/' });
    await q.start(0);
    await q.drain();
    q.setCurrent(2);
    await q.drain();
    expect(synthesize).toHaveBeenCalledTimes(5); // 0,1,2 then 3,4
  });

  it('never synthesizes the same sentence twice', async () => {
    const synthesize = fakeSynth();
    const q = createSynthQueue({ sentences, synthesize, lookahead: 3, cacheDir: '/c/' });
    await q.start(0);
    await q.drain();
    q.setCurrent(1);
    await q.drain();
    const paths = synthesize.mock.calls.map((c) => c[1]);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('starting at a new position discards pending work', async () => {
    const synthesize = fakeSynth();
    const q = createSynthQueue({ sentences, synthesize, lookahead: 3, cacheDir: '/c/' });
    await q.start(0);
    await q.start(30);
    await q.drain();
    const spoken = synthesize.mock.calls.map((c) => c[0].text);
    expect(spoken).toContain('Sentence number 30.');
    expect(q.pathFor(30)).toBe('/c/s30.wav');
  });

  it('skips a sentence that fails to synthesize and keeps going', async () => {
    const synthesize = vi.fn(async (sentence: Sentence, outPath: string) => {
      if (sentence.text.includes('number 1.')) throw new Error('engine blew up');
      return { path: outPath, durationSec: 2, rtf: 0.15 };
    });
    const failed: number[] = [];
    const q = createSynthQueue({
      sentences,
      synthesize,
      lookahead: 3,
      cacheDir: '/c/',
      onFailed: (i) => failed.push(i),
    });
    await q.start(0);
    await q.drain();
    expect(failed).toEqual([1]);
    expect(synthesize).toHaveBeenCalledTimes(3);
    expect(q.pathFor(1)).toBeUndefined();
  });

  it('stops at the end of the document without error', async () => {
    const synthesize = fakeSynth();
    const q = createSynthQueue({
      sentences: sentences.slice(0, 2),
      synthesize,
      lookahead: 10,
      cacheDir: '/c/',
    });
    await q.start(0);
    await q.drain();
    expect(synthesize).toHaveBeenCalledTimes(2);
  });

  it('hands the engine the whole sentence, not only its words', async () => {
    // How a sentence is spoken depends on what it is: a heading is followed by
    // a longer pause than a line of prose. Voice and speed belong to the caller,
    // which closes over them, so the queue has no opinion about them.
    const synthesize = fakeSynth();
    const q = createSynthQueue({ sentences, synthesize, lookahead: 1, cacheDir: '/c/' });
    await q.start(0);
    await q.drain();
    expect(synthesize).toHaveBeenCalledWith(sentences[0], '/c/s0.wav');
  });

  it('stop() halts further synthesis', async () => {
    const synthesize = fakeSynth();
    const q = createSynthQueue({ sentences, synthesize, lookahead: 40, cacheDir: '/c/' });
    await q.start(0);
    q.stop();
    await q.drain();
    expect(synthesize.mock.calls.length).toBeLessThan(40);
  });
});

describe('discarding audio already heard', () => {
  it('deletes sentences well behind the listener', async () => {
    const removed: string[] = [];
    const q = createSynthQueue({
      sentences,
      synthesize: fakeSynth(),
      lookahead: 4,
      cacheDir: '/c/',
      remove: (path) => removed.push(path),
    });

    await q.start(0);
    await q.drain();
    q.setCurrent(20);
    await q.drain();

    // A whole book of audio is several hundred megabytes, and none of it is
    // wanted once it has been spoken.
    expect(removed).toContain('/c/s0.wav');
    expect(removed).toContain('/c/s1.wav');
  });

  it('keeps the sentences just behind, so stepping back is not a re-synthesis', async () => {
    const removed: string[] = [];
    const q = createSynthQueue({
      sentences,
      synthesize: fakeSynth(),
      lookahead: 4,
      cacheDir: '/c/',
      remove: (path) => removed.push(path),
    });

    await q.start(0);
    await q.drain();
    q.setCurrent(20);
    await q.drain();

    expect(removed).not.toContain('/c/s19.wav');
    expect(removed).not.toContain('/c/s20.wav');
  });

  it('never deletes what is being played', async () => {
    const removed: string[] = [];
    const q = createSynthQueue({
      sentences,
      synthesize: fakeSynth(),
      lookahead: 4,
      cacheDir: '/c/',
      remove: (path) => removed.push(path),
    });

    await q.start(0);
    await q.drain();
    for (let at = 0; at < 40; at++) {
      q.setCurrent(at);
      await q.drain();
      expect(removed).not.toContain(`/c/s${at}.wav`);
    }
  });

  it('clears what a previous book left behind when a new one starts', async () => {
    const removed: string[] = [];
    const q = createSynthQueue({
      sentences,
      synthesize: fakeSynth(),
      lookahead: 4,
      cacheDir: '/c/',
      remove: (path) => removed.push(path),
    });

    await q.start(0);
    await q.drain();
    removed.length = 0;
    await q.start(0);

    // A shorter book would otherwise leave the tail of a longer one on disk
    // for ever, since the names only collide as far as the shorter one runs.
    expect(removed).toContain('/c/s0.wav');
  });

  it('works without a remover, for a caller that does not want one', async () => {
    const q = createSynthQueue({ sentences, synthesize: fakeSynth(), lookahead: 4, cacheDir: '/c/' });
    await q.start(0);
    await q.drain();
    expect(() => q.setCurrent(30)).not.toThrow();
  });
});
