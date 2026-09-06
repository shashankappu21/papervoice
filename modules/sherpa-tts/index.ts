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
   * Synthesises one utterance to a WAV file and returns how it went.
   *
   * `silenceMs` of silence is appended to the audio: the playlist is gapless,
   * so a pause between sentences has to be part of the track itself.
   */
  synthesize(
    text: string,
    sid: number,
    speed: number,
    outPath: string,
    silenceMs: number,
  ): Promise<SynthResult>;
  unload(): Promise<void>;
}

export const SherpaTts = requireNativeModule<SherpaTtsNative>('SherpaTts');
