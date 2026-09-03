import { describe, it, expect, vi } from 'vitest';
import { createSynthQueue } from '../src/tts/synthQueue';
import type { Sentence } from '../src/extraction/types';

const sentences: Sentence[] = Array.from({ length: 50 }, (_, i) => ({
  index: i,
  text: `Sentence number ${i}.`,
  boxes: [],
}));

const fakeSynth = () =>
  vi.fn(async (_text: string, _sid: number, _speed: number, outPath: string) => {
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
    const paths = synthesize.mock.calls.map((c) => c[3]);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('starting at a new position discards pending work', async () => {
    const synthesize = fakeSynth();
    const q = createSynthQueue({ sentences, synthesize, lookahead: 3, cacheDir: '/c/' });
    await q.start(0);
    await q.start(30);
    await q.drain();
    const texts = synthesize.mock.calls.map((c) => c[0]);
    expect(texts).toContain('Sentence number 30.');
    expect(q.pathFor(30)).toBe('/c/s30.wav');
  });

  it('skips a sentence that fails to synthesize and keeps going', async () => {
    const synthesize = vi.fn(
      async (text: string, _sid: number, _speed: number, outPath: string) => {
        if (text.includes('number 1.')) throw new Error('engine blew up');
        return { path: outPath, durationSec: 2, rtf: 0.15 };
      },
    );
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

  it('passes the configured voice and speed through to the engine', async () => {
    const synthesize = fakeSynth();
    const q = createSynthQueue({
      sentences,
      synthesize,
      lookahead: 1,
      cacheDir: '/c/',
      sid: 3,
      speed: 1.15,
    });
    await q.start(0);
    await q.drain();
    expect(synthesize).toHaveBeenCalledWith('Sentence number 0.', 3, 1.15, '/c/s0.wav');
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
