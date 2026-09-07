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
  /**
   * How much trailing noise to cut, as a fraction of the utterance's loudest
   * moment. Kitten leaves about a third of a second of breath after the words;
   * Piper does not, and cutting what is not there risks clipping a consonant.
   */
  trimTail?: number;
  /**
   * Kept, but not offered. A voice can be worth loading and not worth choosing
   * -- it stays selectable by whoever already has it, and out of the list for
   * everyone else. Hiding is not removing: removed voices get their files
   * deleted from the phone as unknown.
   */
  hidden?: boolean;
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
 * The speakers are in the model's own order, which alternates male first --
 * expr-voice-2-m, expr-voice-2-f, and so on. KittenML's published list of names
 * is alphabetical-ish and does NOT follow it: mapping the names to ids in that
 * order labelled every voice with the wrong gender, which is how this was
 * found. The names below are paired to the order the model actually uses.
 *
 * Speakers 1 and 6 read slowly enough to be uncomfortable even with the rate
 * correction below, so they are not offered. They stay in the catalog because
 * they are part of a download that is already on the phone, and because anyone
 * who had one selected should keep hearing it rather than have the app change
 * voice underneath them. Their ids are written out rather than taken from this
 * list's order, so hiding a speaker cannot shift the others onto the wrong one.
 */
const KITTEN_VOICES: Array<{
  speakerId: number;
  name: string;
  gender: 'female' | 'male';
  hidden?: boolean;
}> = [
  { speakerId: 0, name: 'Jasper', gender: 'male' },
  { speakerId: 1, name: 'Bella', gender: 'female', hidden: true },
  { speakerId: 2, name: 'Bruno', gender: 'male' },
  { speakerId: 3, name: 'Luna', gender: 'female' },
  { speakerId: 4, name: 'Hugo', gender: 'male' },
  { speakerId: 5, name: 'Rosie', gender: 'female' },
  { speakerId: 6, name: 'Leo', gender: 'male', hidden: true },
  { speakerId: 7, name: 'Kiki', gender: 'female' },
];

KITTEN_VOICES.forEach(({ speakerId, name, gender, hidden }) => {
  VOICES.push({
    id: `kitten-nano-${speakerId}`,
    packId: 'kitten-nano-v0_2',
    family: 'kitten',
    name,
    accent: 'US',
    gender,
    hidden,
    sizeBytes: 23_000_000,
    modelUrl: `${KITTEN}/model.fp16.onnx`,
    tokensUrl: `${KITTEN}/tokens.txt`,
    voicesUrl: `${KITTEN}/voices.bin`,
    modelSha256: '',
    speakerId,
    // It reads slowly by nature; corrected here rather than left to the
    // listener to notice and fix.
    defaultRate: 1.15,
    // Measured on real utterances: the breathy tail sits at about a tenth of
    // the loudest moment. 0.3 was cutting through the words' own decay instead,
    // leaving the waveform stepping to silence from a third of full volume.
    trimTail: 0.12,
    licence: 'Apache-2.0',
  });
});

/** The voices to put in front of someone choosing one. */
export const OFFERED_VOICES: VoiceMeta[] = VOICES.filter((voice) => !voice.hidden);

/** Looks up any voice, offered or not, so a saved choice still resolves. */
export const findVoice = (id: string): VoiceMeta | undefined =>
  VOICES.find((voice) => voice.id === id);
