import { requireNativeModule } from 'expo-modules-core';

export interface LoadResult {
  sampleRate: number;
  /** Voices with one speaker report 1; a multi-speaker pack reports its count. */
  numSpeakers: number;
}

export interface SynthResult {
  path: string;
  /** How long the track takes to play, appended silence included. */
  durationSec: number;
  /** Real-time factor: below 1 means synthesis outruns playback. */
  rtf: number;
}

interface SherpaTtsNative {
  /** Loads a Piper voice. All paths are absolute paths in the app's storage. */
  load(model: string, tokens: string, dataDir: string, numThreads: number): Promise<LoadResult>;
  /**
   * Synthesises one sentence to a single WAV.
   *
   * `parts` is the sentence, already cut at clause boundaries when it is long
   * enough that one synthesis job would hold up the queue. `seamMs` separates
   * those pieces and `tailMs` follows the sentence: silence is written into the
   * audio because a player cannot be relied on to leave a gap of any length.
   */
  synthesize(
    parts: string[],
    sid: number,
    speed: number,
    outPath: string,
    seamMs: number,
    tailMs: number,
  ): Promise<SynthResult>;
  unload(): Promise<void>;
}

export const SherpaTts = requireNativeModule<SherpaTtsNative>('SherpaTts');
