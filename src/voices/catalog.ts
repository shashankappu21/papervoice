/**
 * The voices this app can install.
 *
 * The catalog ships inside the app so the voice list renders with no network,
 * and every file is named by absolute URL. No voice is bundled: the app is
 * useful the moment it installs, and a natural voice is a deliberate download.
 *
 * Each voice is two plain HTTPS fetches. The phonemiser data every Piper voice
 * shares is installed once, separately, rather than repeated per voice -- which
 * is also what keeps a download free of archives, since React Native has no
 * business unpacking tar.bz2.
 */
export interface VoiceMeta {
  id: string;
  /**
   * Which kind of model it is. They load differently: a vits voice is one
   * speaker baked into the model, while kokoro keeps every speaker's embedding
   * in a file beside it.
   */
  family: 'vits' | 'kokoro';
  /** A human name. A listener chooses a voice, not a dataset. */
  name: string;
  accent: 'US' | 'GB';
  gender: 'female' | 'male';
  /** Bytes, so the app can say "63 MB" before asking for the download. */
  sizeBytes: number;
  modelUrl: string;
  tokensUrl: string;
  /** Kokoro only: the speaker embeddings, without which it cannot speak. */
  voicesUrl?: string;
  /** Kokoro multi-language only: how it pronounces the language it is reading. */
  lexiconUrl?: string;
  /** Which speaker to use out of a model that holds many. */
  speakerId?: number;
  /**
   * How this voice turns letters into sounds. Kokoro's token set has no
   * r-coloured vowels, so espeak's American English hands it phonemes it cannot
   * represent and they are dropped -- which is heard as slurred, unclear words.
   */
  phonemes?: { useEspeak: boolean; lang: string };
  modelSha256: string;
  /** Some voices read slowly by nature and are corrected per voice. */
  defaultRate: number;
  /** What the licence permits, shown rather than buried. */
  licence: string;
}

const SHERPA = 'https://huggingface.co/csukuangfj';

export const VOICES: VoiceMeta[] = [
  {
    id: 'ljspeech-medium',
    family: 'vits',
    name: 'Lyra',
    accent: 'US',
    gender: 'female',
    sizeBytes: 63_531_507,
    modelUrl: `${SHERPA}/vits-piper-en_US-ljspeech-medium/resolve/main/en_US-ljspeech-medium.onnx`,
    tokensUrl: `${SHERPA}/vits-piper-en_US-ljspeech-medium/resolve/main/tokens.txt`,
    modelSha256: '8ceba58a4b540d4e7e7e24ad079cf0d92762a4fd334e059f12940787c6c37b3d',
    defaultRate: 1,
    licence: 'LJ Speech, public domain',
  },
];

const KOKORO = 'https://huggingface.co/csukuangfj/kokoro-int8-multi-lang-v1_1/resolve/main';

/**
 * Kokoro, quantised to int8. The full-precision build is 345MB, which the brief
 * bans outright for live synthesis on a phone; this one is 114MB of model plus
 * 53MB of speaker embeddings, and whether it is fast enough here is exactly
 * what measuring it will say.
 */
VOICES.push({
  id: 'kokoro-int8-v1_1',
  family: 'kokoro',
  name: 'Kokoro',
  accent: 'US',
  gender: 'female',
  sizeBytes: 114_000_000 + 53_000_000,
  modelUrl: `${KOKORO}/model.int8.onnx`,
  tokensUrl: `${KOKORO}/tokens.txt`,
  voicesUrl: `${KOKORO}/voices.bin`,
  lexiconUrl: `${KOKORO}/lexicon-us-en.txt`,
  // Checked after downloading rather than trusted: filled in once measured.
  modelSha256: '',
  speakerId: 0,
  // Both, which is what sherpa requires: the lexicon gives the pronunciations
  // this model was trained on, and espeak covers whatever the lexicon lacks.
  // Turning espeak off is rejected outright -- the config will not build.
  phonemes: { useEspeak: true, lang: 'en-us' },
  defaultRate: 1,
  licence: 'Apache-2.0',
});

export const findVoice = (id: string): VoiceMeta | undefined =>
  VOICES.find((voice) => voice.id === id);
