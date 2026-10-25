import { requireNativeModule } from 'expo-modules-core';

export interface SystemVoice {
  /** The engine's own name for the voice, used to select it again. */
  id: string;
  locale: string;
  country: string;
  /** The engine's coarse quality scale; 500 is its highest. */
  quality: number;
  /**
   * True when speaking requires sending the text to a server. This app never
   * offers those: a document must not leave the phone to be read aloud.
   */
  needsNetwork: boolean;
  /**
   * Listed, but its voice data is not downloaded yet: until it is, the engine
   * speaks with another voice (Android's KEY_FEATURE_NOT_INSTALLED).
   */
  notInstalled?: boolean;
  /** The engine's raw feature flags for the voice, for diagnosing. */
  features?: string[];
}

interface SystemTtsNative {
  /** English voices the phone already has, offline and network alike. */
  listVoices(): Promise<SystemVoice[]>;
  /** Whether there is a connection, and whether it is metered (mobile data). */
  networkState(): { connected: boolean; metered: boolean };
  /** Writes one utterance to a WAV, the same shape the neural engine produces. */
  synthesize(
    text: string,
    voiceId: string,
    outPath: string,
  ): Promise<{ path: string; durationSec: number }>;
}

export const SystemTts = requireNativeModule<SystemTtsNative>('SystemTts');
