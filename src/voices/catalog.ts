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
  family: 'vits' | 'kokoro' | 'kitten';
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
   * Which download this voice comes from. Several voices can share one: a model
   * holding many speakers is fetched once and offered as a voice per speaker.
   * Defaults to the voice's own id.
   */
  packId?: string;
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

/*
 * Kokoro was tried here and removed. Measured on a realme RMX3031, the int8
 * build ran at a real-time factor of 1.63 to 2.35 -- roughly twice as long to
 * make speech as to play it, so synthesis can never get ahead of a listener and
 * every sentence is a wait. One 227-character sentence took about 19 seconds of
 * synthesis for 12 seconds of audio; Lyra does the same work in under two.
 *
 * It also drops phonemes: Kokoro's token set has no r-coloured vowels, so
 * espeak's American English hands it sounds it cannot represent and they are
 * skipped, which is heard on ordinary words.
 *
 * The download was 167MB -- a 114MB model plus 53MB of speaker embeddings --
 * for a voice that cannot keep up. A smaller quantisation would have to be
 * about ten times faster to become usable, which quantisation does not do.
 */

const KITTEN = 'https://huggingface.co/csukuangfj/kitten-nano-en-v0_2-fp16/resolve/main';

/**
 * Kitten nano: 23MB against Lyra's 63MB, Apache-2.0, and eight speakers in 8KB
 * of embeddings beside the model -- so one download is eight voices, and they
 * share it rather than fetching the same model eight times.
 *
 * Measured here at a real-time factor of 0.31 to 0.37: slower than Lyra's 0.15
 * but far inside what a listener can outrun, and with none of the dropped
 * phonemes that made Kokoro unusable.
 *
 * The names are KittenML's own, in the order its voice list gives, which is
 * taken to be the order of the speaker ids. If a voice does not sound like its
 * name, that assumption is where to look.
 */
const KITTEN_VOICES: Array<[string, 'female' | 'male']> = [
  ['Bella', 'female'],
  ['Jasper', 'male'],
  ['Luna', 'female'],
  ['Bruno', 'male'],
  ['Rosie', 'female'],
  ['Hugo', 'male'],
  ['Kiki', 'female'],
  ['Leo', 'male'],
];

KITTEN_VOICES.forEach(([name, gender], speakerId) => {
  VOICES.push({
    id: `kitten-nano-${speakerId}`,
    packId: 'kitten-nano-v0_2',
    family: 'kitten',
    name,
    accent: 'US',
    gender,
    sizeBytes: 23_000_000,
    modelUrl: `${KITTEN}/model.fp16.onnx`,
    tokensUrl: `${KITTEN}/tokens.txt`,
    voicesUrl: `${KITTEN}/voices.bin`,
    modelSha256: '',
    speakerId,
    // It reads slowly by nature; corrected here rather than left to the
    // listener to notice and fix.
    defaultRate: 1.15,
    licence: 'Apache-2.0',
  });
});

export const findVoice = (id: string): VoiceMeta | undefined =>
  VOICES.find((voice) => voice.id === id);
