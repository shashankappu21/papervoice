import { requireNativeModule } from 'expo-modules-core';

export interface LoadResult {
  sampleRate: number;
  /** Voices with one speaker report 1; a multi-speaker pack reports its count. */
  numSpeakers: number;
}

export interface SynthResult {
  path: string;
  durationSec: number;
  /** Real-time factor: below 1 means synthesis outruns playback. */
  rtf: number;
}

interface SherpaTtsNative {
  /** Loads a Piper voice. All paths are absolute paths in the app's storage. */
  load(model: string, tokens: string, dataDir: string, numThreads: number): Promise<LoadResult>;
  /** Synthesises one utterance to a WAV file and returns how it went. */
  synthesize(text: string, sid: number, speed: number, outPath: string): Promise<SynthResult>;
  unload(): Promise<void>;
}

export const SherpaTts = requireNativeModule<SherpaTtsNative>('SherpaTts');
