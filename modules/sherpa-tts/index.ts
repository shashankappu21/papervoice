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
   * Loads a Kokoro voice. Its speaker embeddings live in a separate `voices`
   * file, so one model can speak in many voices, selected by speaker id.
   */
  loadKokoro(
    model: string,
    voices: string,
    tokens: string,
    /** espeak data, or empty to phonemise from the lexicon instead. */
    dataDir: string,
    /** The voice's own pronunciations, or empty to leave it to espeak. */
    lexicon: string,
    /** Which espeak voice does the phonemising, when espeak is doing it. */
    lang: string,
    numThreads: number,
  ): Promise<LoadResult>;

  /** Loads a Kitten voice: a small model with its speakers in a file beside it. */
  loadKitten(
    model: string,
    voices: string,
    tokens: string,
    dataDir: string,
    numThreads: number,
  ): Promise<LoadResult>;

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
    /**
     * Cuts trailing noise below this fraction of the utterance's own loudest
     * moment. Some models leave a breathy sound after the words end, which
     * silence does not hide. Zero turns it off.
     */
    trim: number,
  ): Promise<SynthResult>;
  /**
   * Unpacks the bundled phonemiser data to `destination` if it is not already
   * there, and returns the path. Every Piper voice shares it, so it ships with
   * the app once rather than with each voice.
   */
  installEspeakData(destination: string): Promise<string>;

  /** Hashes a file natively, so 63MB never passes through JavaScript. */
  sha256(path: string): Promise<string>;

  unload(): Promise<void>;
}

export const SherpaTts = requireNativeModule<SherpaTtsNative>('SherpaTts');
