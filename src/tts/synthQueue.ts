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
export function createSynthQueue(opts: SynthQueueOptions): SynthQueue {
  const { sentences, synthesize, cacheDir, lookahead } = opts;

  /** index -> output path; an empty string marks a sentence that failed. */
  const produced = new Map<number, string>();
  let current = 0;
  /** Bumped on start()/stop() so an in-flight pump abandons stale work. */
  let generation = 0;
  let running: Promise<void> | null = null;
  let stopped = false;

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
      produced.clear();
      kick();
    },

    setCurrent(index: number) {
      current = index;
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
