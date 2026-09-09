import type { Sentence } from '../extraction/types';

export interface SynthResult {
  path: string;
  durationSec: number;
  /** Real-time factor: below 1 means synthesis is faster than playback. */
  rtf: number;
}

/**
 * Turns one sentence into one audio file. The whole sentence is handed over,
 * not just its text: how it is spoken depends on what it is -- a heading is
 * followed by a longer pause than a line of prose.
 */
export type SynthesizeFn = (sentence: Sentence, outPath: string) => Promise<SynthResult>;

export interface SynthQueueOptions {
  sentences: Sentence[];
  synthesize: SynthesizeFn;
  cacheDir: string;
  /**
   * Deletes a finished audio file. Optional so the queue still runs without a
   * filesystem, which is how it is tested.
   */
  remove?: (path: string) => void;
  /** How many sentences to keep synthesized ahead of the current one. */
  lookahead: number;
  onReady?: (index: number, path: string) => void;
  onFailed?: (index: number, error: Error) => void;
}

export interface SynthQueue {
  /** Restart synthesis at `fromIndex`, discarding anything already produced. */
  start(fromIndex: number): Promise<void>;
  setCurrent(index: number): void;
  pathFor(index: number): string | undefined;
  /** Resolves once no synthesis is outstanding. Used by tests and shutdown. */
  drain(): Promise<void>;
  stop(): void;
}

/**
 * Keeps a sliding window of sentences synthesized ahead of playback.
 *
 * The engine is injected rather than imported so this module stays free of
 * React Native and runs under Vitest on the desktop.
 */
/**
 * Sentences kept behind the listener before their audio is thrown away.
 *
 * Not zero: stepping back a sentence or two is common, and re-synthesising
 * what was just played is a wait for something the phone had a moment ago.
 */
const KEEP_BEHIND = 6;

export function createSynthQueue(opts: SynthQueueOptions): SynthQueue {
  const { sentences, synthesize, cacheDir, lookahead, remove } = opts;

  /** index -> output path; an empty string marks a sentence that failed. */
  const produced = new Map<number, string>();
  let current = 0;
  /** Bumped on start()/stop() so an in-flight pump abandons stale work. */
  let generation = 0;
  let running: Promise<void> | null = null;
  let stopped = false;

  /**
   * Throws away audio the listener is well past.
   *
   * A book is a few hundred megabytes of speech -- roughly a quarter of a
   * megabyte a sentence -- and none of it is worth keeping once it has been
   * heard. Without this the cache grew to the size of the whole book.
   */
  const discardBefore = (index: number): void => {
    if (!remove) return;
    for (const [at, path] of produced) {
      if (at >= index) continue;
      // An empty path marks a sentence that failed; there is no file to remove,
      // but the record of the failure has served its purpose too.
      if (path) remove(path);
      produced.delete(at);
    }
  };

  const nextIndex = (): number => {
    const end = Math.min(current + lookahead, sentences.length);
    for (let i = current; i < end; i++) {
      if (!produced.has(i)) return i;
    }
    return -1;
  };

  const pump = async (myGeneration: number): Promise<void> => {
    for (;;) {
      if (stopped || myGeneration !== generation) return;

      const index = nextIndex();
      if (index === -1) return;

      const outPath = `${cacheDir}s${index}.wav`;
      try {
        const result = await synthesize(sentences[index], outPath);
        if (stopped || myGeneration !== generation) return;
        produced.set(index, result.path);
        opts.onReady?.(index, result.path);
      } catch (error) {
        if (stopped || myGeneration !== generation) return;
        // Record the failure so the window advances instead of retrying forever.
        produced.set(index, '');
        opts.onFailed?.(index, error as Error);
      }
    }
  };

  const kick = (): void => {
    if (running || stopped) return;
    const myGeneration = generation;
    running = pump(myGeneration).finally(() => {
      running = null;
    });
  };

  return {
    async start(fromIndex: number) {
      generation += 1;
      stopped = true; // stop the in-flight pump from taking more work
      if (running) await running;
      stopped = false;
      current = fromIndex;
      // Everything, not just what is behind: a shorter book would otherwise
      // leave the tail of a longer one on disk for ever, since the names only
      // collide as far as the shorter one runs.
      discardBefore(Number.POSITIVE_INFINITY);
      produced.clear();
      kick();
    },

    setCurrent(index: number) {
      current = index;
      discardBefore(index - KEEP_BEHIND);
      kick();
    },

    pathFor(index: number) {
      const path = produced.get(index);
      return path ? path : undefined;
    },

    async drain() {
      while (running) await running;
    },

    stop() {
      stopped = true;
      generation += 1;
    },
  };
}
