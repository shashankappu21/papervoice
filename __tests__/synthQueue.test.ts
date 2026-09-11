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
    const q = createSynthQueue({ sentences, synthesize, lookahead: 5, pathOf: (i: number) => `/c/s${i}.wav` });
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
      pathOf: (i: number) => `/c/s${i}.wav`,
      onReady: (i) => ready.push(i),
    });
    await q.start(0);
    await q.drain();
    expect(ready).toEqual([0, 1, 2]);
  });

  it('advances the window when the current index moves', async () => {
    const synthesize = fakeSynth();
    const q = createSynthQueue({ sentences, synthesize, lookahead: 3, pathOf: (i: number) => `/c/s${i}.wav` });
    await q.start(0);
    await q.drain();
    q.setCurrent(2);
    await q.drain();
    expect(synthesize).toHaveBeenCalledTimes(5); // 0,1,2 then 3,4
  });

  it('never synthesizes the same sentence twice', async () => {
    const synthesize = fakeSynth();
    const q = createSynthQueue({ sentences, synthesize, lookahead: 3, pathOf: (i: number) => `/c/s${i}.wav` });
    await q.start(0);
    await q.drain();
    q.setCurrent(1);
    await q.drain();
    const paths = synthesize.mock.calls.map((c) => c[1]);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('starting at a new position discards pending work', async () => {
    const synthesize = fakeSynth();
    const q = createSynthQueue({ sentences, synthesize, lookahead: 3, pathOf: (i: number) => `/c/s${i}.wav` });
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
      pathOf: (i: number) => `/c/s${i}.wav`,
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
      pathOf: (i: number) => `/c/s${i}.wav`,
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
    const q = createSynthQueue({ sentences, synthesize, lookahead: 1, pathOf: (i: number) => `/c/s${i}.wav` });
    await q.start(0);
    await q.drain();
    expect(synthesize).toHaveBeenCalledWith(sentences[0], '/c/s0.wav');
  });

  it('stop() halts further synthesis', async () => {
    const synthesize = fakeSynth();
    const q = createSynthQueue({ sentences, synthesize, lookahead: 40, pathOf: (i: number) => `/c/s${i}.wav` });
    await q.start(0);
    q.stop();
    await q.drain();
    expect(synthesize.mock.calls.length).toBeLessThan(40);
  });
});

describe('reusing audio that is already there', () => {
  it('does not synthesise a sentence whose file exists', async () => {
    const synthesize = fakeSynth();
    const q = createSynthQueue({
      sentences,
      synthesize,
      lookahead: 4,
      pathOf: (i: number) => `/c/s${i}.wav`,
      // Everything below 10 was made on an earlier run.
      exists: (path: string) => Number(path.match(/s(\d+)/)?.[1]) < 10,
    });

    await q.start(0);
    await q.drain();

    // Stepping back into read territory, or resuming a book tomorrow, should
    // cost nothing at all.
    expect(synthesize).not.toHaveBeenCalled();
    expect(q.pathFor(3)).toBe('/c/s3.wav');
  });

  it('starts again from a new place without discarding what it has', async () => {
    const synthesize = fakeSynth();
    const q = createSynthQueue({
      sentences,
      synthesize,
      lookahead: 3,
      pathOf: (i: number) => `/c/s${i}.wav`,
    });

    await q.start(10);
    await q.drain();
    const madeFirst = synthesize.mock.calls.length;

    // Going back is what used to wipe the cache and re-synthesise everything.
    await q.start(10);
    await q.drain();

    expect(synthesize.mock.calls.length).toBe(madeFirst);
    expect(q.pathFor(10)).toBe('/c/s10.wav');
  });

  it('keeps what it made when the reader moves on', async () => {
    const q = createSynthQueue({
      sentences,
      synthesize: fakeSynth(),
      lookahead: 3,
      pathOf: (i: number) => `/c/s${i}.wav`,
    });

    await q.start(0);
    await q.drain();
    q.setCurrent(20);
    await q.drain();

    // Eviction is a matter of disk budget now, decided elsewhere, not of how
    // far the reader has walked past a sentence.
    expect(q.pathFor(0)).toBe('/c/s0.wav');
  });
});

describe('when the voice or the speed changes', () => {
  it('does not hand back audio made for a different voice', async () => {
    let voice = 'lyra';
    const synthesize = fakeSynth();
    const q = createSynthQueue({
      sentences,
      synthesize,
      lookahead: 2,
      pathOf: (i: number) => `/c/${voice}/s${i}.wav`,
    });

    await q.start(0);
    await q.drain();
    expect(q.pathFor(0)).toBe('/c/lyra/s0.wav');

    voice = 'kiki';
    // The old file still exists, but it is the old voice. Playing it would be
    // the app ignoring the voice that was just chosen.
    expect(q.pathFor(0)).toBeUndefined();

    await q.start(0);
    await q.drain();
    expect(q.pathFor(0)).toBe('/c/kiki/s0.wav');
  });
});
