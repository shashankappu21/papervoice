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
  /**
   * Where that licence is actually stated, when it is not the repository we
   * download from.
   *
   * Needed because the two can differ, and the difference is invisible until
   * someone looks: Kitten's model is fetched from a mirror that states no
   * licence at all, while the Apache-2.0 above comes from KittenML upstream.
   * Naming the source turns the claim into something `npm run audit:licences`
   * can check, rather than something the catalog asserts about itself.
   */
  licenceSource?: string;
  /**
   * The heading to read the licence under, where `licenceSource` is a page
   * describing several models.
   *
   * Bryce Beattie publishes eleven models on one page under two different
   * licences. Without a heading to scope to, the auditor can only say the page
   * disagrees with itself and refuse to answer -- which is the right answer to
   * the wrong question. This asks the question that has an answer.
   */
  licenceAnchor?: string;
  /**
   * True where the licence forbids commercial use. These are legitimate in a
   * free app and would have to go if one were ever sold, so they are marked
   * rather than remembered -- dropping them later is then a filter, not an
   * archaeology exercise across ten entries.
   */
  nonCommercial?: boolean;
}

const SHERPA = 'https://huggingface.co/csukuangfj';

/**
 * Piper's English voices, of which far fewer are usable than the list suggests.
 *
 * Most of them say "Finetuned from U.S. English lessac voice" on their model
 * card, and lessac is Blizzard 2013 -- licensed for research only. A second
 * group descends from Ryan, which is non-commercial. The dataset licence does
 * not rescue them: sam is Apache-2.0 data and joe is CC0 data, both trained on
 * top of lessac. What matters is what the weights descend from, so amy, alan,
 * alba, aru, vctk, jenny_dioco, kusal, arctic, sam, joe, mike, libritts_r,
 * northern_english_male, kathleen and danny are all absent on purpose.
 *
 * What is left, almost entirely, is Bryce Beattie's work: voices trained from
 * scratch on public-domain LibriVox recordings, with the lineage written down.
 */
const PIPER: Array<{
  key: string;
  /**
   * Overrides the id derived from the key. Only Lyra needs one: it shipped
   * before the ids carried a language prefix, and changing an id now would
   * orphan the 63MB already downloaded under the old name -- and then delete
   * it, since a directory no voice claims is treated as unknown.
   */
  id?: string;
  name: string;
  accent: 'US' | 'GB';
  gender: 'female' | 'male';
  sizeBytes: number;
  sha256: string;
  licence: string;
  nonCommercial?: boolean;
  hidden?: boolean;
}> = [
  // Public domain, trained from scratch. Safe under any licence we ever pick.
  {
    key: 'en_US-ljspeech-medium',
    id: 'ljspeech-medium',
    name: 'Lyra',
    accent: 'US',
    gender: 'female',
    sizeBytes: 63_531_507,
    sha256: '8ceba58a4b540d4e7e7e24ad079cf0d92762a4fd334e059f12940787c6c37b3d',
    licence: 'LJ Speech, public domain',
  },
  {
    key: 'en_US-kristin-medium',
    name: 'Kristin',
    accent: 'US',
    gender: 'female',
    sizeBytes: 63_531_507,
    sha256: 'f9a5c375c70ddc33ccdb3969c76a4d7cc5255ac08119a312b0034a1d07041be6',
    licence: 'LibriVox, public domain',
  },
  {
    /*
     * Hidden: it mispronounces words that Kristin, on the identical pipeline,
     * says correctly. Trained from scratch for 1200 epochs where Kristin had
     * 2000, and its own card ends "I forgot to save the ckpt file on this one,
     * sorry" -- so the difference is the training, not anything here.
     */
    hidden: true,
    key: 'en_US-norman-medium',
    name: 'Norman',
    accent: 'US',
    gender: 'male',
    sizeBytes: 63_531_507,
    sha256: 'fa06b6b8b280e176b17f8424e05ca12d0223eeac9a31c87230937fe7120fbe2a',
    licence: 'LibriVox, public domain',
  },
  {
    // Finetuned from Kristin, which was trained from scratch -- so the whole
    // chain stays public domain. Worth stating, because for most Piper voices
    // it is exactly this line that disqualifies them.
    // Hidden for the same reason as Norman: 600 epochs of finetuning on top
    // of Kristin was not enough, and it shows in the words it gets wrong.
    hidden: true,
    key: 'en_US-john-medium',
    name: 'John',
    accent: 'US',
    gender: 'male',
    sizeBytes: 63_531_507,
    sha256: '7ab60237f77e06c8f32b811080b7ad82d23bc5bacc4bba2c35e58aeae6833364',
    licence: 'LibriVox, public domain',
  },
  {
    key: 'en_GB-cori-medium',
    name: 'Cori',
    accent: 'GB',
    gender: 'female',
    sizeBytes: 63_531_507,
    sha256: '8b0d3cdd77f2878e0aa2048103eabb4d01b334783f99629f042bcf703aeba487',
    licence: 'Public domain',
  },

  // Non-commercial. Fine while the app is free and open; the first thing to go
  // if it is ever sold.
  {
    key: 'en_US-ryan-medium',
    name: 'Ryan',
    accent: 'US',
    gender: 'male',
    sizeBytes: 63_201_425,
    sha256: '8a4063318faeda9bf67f89d25b29cc4bd5fde8832422aa451a5d5d2647553081',
    licence: 'CC BY-NC-SA 4.0',
    nonCommercial: true,
  },
  {
    // The HiFi Captain voices are published without names of their own.
    key: 'en_US-hfc_female-medium',
    name: 'Grace',
    accent: 'US',
    gender: 'female',
    sizeBytes: 63_201_425,
    sha256: '6d8b3711715f17f29b9f0ded97571924ead9a06e300bfdf3680b014a51ddc9e5',
    licence: 'CC BY-NC-SA 4.0',
    nonCommercial: true,
  },
  {
    key: 'en_US-hfc_male-medium',
    name: 'Walter',
    accent: 'US',
    gender: 'male',
    sizeBytes: 63_201_425,
    sha256: '2dba095f50970dddc4f6da704b25a9767f334011b369df2ef496690ab71ea23c',
    licence: 'CC BY-NC-SA 4.0',
    nonCommercial: true,
  },
  {
    // One voice in two accents, so the name alone cannot tell them apart.
    key: 'en_GB-miro-high',
    name: 'Miro (British)',
    accent: 'GB',
    gender: 'male',
    sizeBytes: 63_153_791,
    sha256: '68c263187b6a741bc0fe6b73d51471f7b074826bcf23852b048e0ab17b4bac12',
    licence: 'CC BY-NC-SA 4.0',
    nonCommercial: true,
  },
  {
    key: 'en_US-miro-high',
    name: 'Miro (American)',
    accent: 'US',
    gender: 'male',
    sizeBytes: 63_153_781,
    sha256: 'b8a9c21c10e4a65880be47419a847d4d5844e9d4294ab1814ea4339be4838b92',
    licence: 'CC BY-NC-SA 4.0',
    nonCommercial: true,
  },
  {
    key: 'en_GB-dii-high',
    name: 'Dii',
    accent: 'GB',
    gender: 'female',
    sizeBytes: 63_153_791,
    sha256: '6cf7c3a8ff40ae45e675a548ab2b7592239218880d73ecb036332c2356b85de7',
    licence: 'CC BY-NC-SA 4.0',
    nonCommercial: true,
  },
];

export const VOICES: VoiceMeta[] = PIPER.map((voice) => ({
  id: voice.id ?? voice.key,
  family: 'vits',
  name: voice.name,
  accent: voice.accent,
  gender: voice.gender,
  sizeBytes: voice.sizeBytes,
  // Every Piper voice is the same two files under a predictable name, so the
  // URLs are derived rather than written out eleven times.
  modelUrl: `${SHERPA}/vits-piper-${voice.key}/resolve/main/${voice.key}.onnx`,
  tokensUrl: `${SHERPA}/vits-piper-${voice.key}/resolve/main/tokens.txt`,
  modelSha256: voice.sha256,
  defaultRate: 1,
  licence: voice.licence,
  nonCommercial: voice.nonCommercial,
  hidden: voice.hidden,
}));

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
 * None of them are offered. Every one mispronounces the same sounds -- the j
 * in "judge", the ch in "church", r-coloured vowels -- because sherpa hands
 * the model eSpeak's phonemes while its token map carries an alphabet eSpeak
 * cannot produce. docs/KNOWN_ISSUES.md has the measurements. It is not fixable
 * from here: sherpa takes text rather than phonemes, and unlike the vits
 * config the kitten one has no lexicon field to route around it.
 *
 * They stay in the catalog rather than being deleted because
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
  { speakerId: 0, name: 'Jasper', gender: 'male', hidden: true },
  { speakerId: 1, name: 'Bella', gender: 'female', hidden: true },
  { speakerId: 2, name: 'Bruno', gender: 'male', hidden: true },
  { speakerId: 3, name: 'Luna', gender: 'female', hidden: true },
  { speakerId: 4, name: 'Hugo', gender: 'male', hidden: true },
  { speakerId: 5, name: 'Rosie', gender: 'female', hidden: true },
  { speakerId: 6, name: 'Leo', gender: 'male', hidden: true },
  { speakerId: 7, name: 'Kiki', gender: 'female', hidden: true },
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
    // Stated upstream by KittenML. The mirror the model is fetched from states
    // no licence at all, so without this the claim has no source to check.
    licenceSource: 'https://huggingface.co/KittenML/kitten-tts-nano-0.2/resolve/main/README.md',
  });
});

const BRYCE = 'https://sfo3.digitaloceanspaces.com/bkmdls';
const BRYCE_PAGE = 'https://brycebeattie.com/files/tts/';

/**
 * ManyVoice: sixteen speakers in one 77MB download, all public domain.
 *
 * The same author as Kristin, Cori, Norman and John, trained the same way from
 * LibriVox recordings that were public domain to begin with -- so unlike almost
 * every other multi-speaker English model, nothing in its lineage forbids
 * selling it. It was never uploaded to Piper's repository, which is why it
 * appears in no list of Piper voices.
 *
 * It needs nothing new to run. `npm run phonemes -- compare ljspeech-medium
 * <its config>` reports 157 tokens each and no difference at all, so it takes
 * the phonemes we already produce and the tokens file we already ship; the only
 * thing separating one of these voices from another is a speaker id.
 *
 * Fourteen of the sixteen are offered. All were auditioned one sample at a
 * time before any of them was shown, because 400 epochs is low and the epoch
 * count has already proved useless here as a predictor -- Cori is fine at 640,
 * Norman is not at 1200. Rose and Olive did not pass and stay hidden.
 *
 * The genders are still read off the readers' names, and which four speakers
 * are British is recorded nowhere, so `unsure` marks the ones where the name
 * does not settle it. Those labels are cosmetic and wrong ones are worth
 * fixing -- guessing exactly this from a published list is how every Kitten
 * voice ended up labelled with the wrong gender -- but none of it stops a
 * voice from reading a book correctly.
 */
const MANYVOICE_SPEAKERS: Array<{
  speakerId: number;
  /** The LibriVox reader, as the model's own speaker_id_map names them. */
  reader: string;
  name: string;
  gender: 'female' | 'male';
  accent: 'US' | 'GB';
  /** True where the name does not settle the gender or accent. */
  unsure?: boolean;
  /** Kept out of the list: auditioned and not good enough to offer. */
  hidden?: boolean;
}> = [
  { speakerId: 0, reader: 'Cori_Samuel', name: 'Cora', gender: 'female', accent: 'GB' },
  { speakerId: 1, reader: 'Kara_Shallenberg', name: 'Kara', gender: 'female', accent: 'US' },
  { speakerId: 2, reader: 'Kristin_Hughes', name: 'Kris', gender: 'female', accent: 'US' },
  { speakerId: 3, reader: 'Maria_Kasper', name: 'Maria', gender: 'female', accent: 'US' },
  { speakerId: 4, reader: 'Mike_Pelton', name: 'Mike', gender: 'male', accent: 'US' },
  { speakerId: 5, reader: 'Mark_Nelson', name: 'Mark', gender: 'male', accent: 'US' },
  { speakerId: 6, reader: 'Michael_Scherer', name: 'Michael', gender: 'male', accent: 'US' },
  { speakerId: 7, reader: 'James_K_White', name: 'James', gender: 'male', accent: 'US' },
  // Auditioned and rejected: does not read cleanly enough to offer.
  { speakerId: 8, reader: 'Rose_Ibex', name: 'Rose', gender: 'female', accent: 'US', hidden: true },
  {
    speakerId: 9,
    reader: 'progressingamerica',
    name: 'Wendell',
    gender: 'male',
    accent: 'US',
    unsure: true,
  },
  { speakerId: 10, reader: 'Steve_C', name: 'Steve', gender: 'male', accent: 'US' },
  // Auditioned and rejected, as above.
  { speakerId: 11, reader: 'Owlivia', name: 'Olive', gender: 'female', accent: 'GB', hidden: true },
  { speakerId: 12, reader: 'Paul_Hampton', name: 'Paul', gender: 'male', accent: 'GB', unsure: true },
  { speakerId: 13, reader: 'Jennifer_Dorr', name: 'Jenny', gender: 'female', accent: 'US' },
  { speakerId: 14, reader: 'Emily_Cripps', name: 'Emily', gender: 'female', accent: 'US', unsure: true },
  {
    speakerId: 15,
    reader: 'Martin_Clifton',
    name: 'Martin',
    gender: 'male',
    accent: 'GB',
    unsure: true,
  },
];

MANYVOICE_SPEAKERS.forEach(({ speakerId, name, gender, accent, hidden }) => {
  VOICES.push({
    id: `manyvoice-${speakerId}`,
    packId: 'manyvoice',
    family: 'vits',
    name,
    accent,
    /*
     * Hidden until the model is hosted somewhere, which is not Bryce's bucket.
     *
     * sherpa will not load what he publishes. It reads seven key/value pairs
     * out of the ONNX file itself -- sample_rate, n_speakers and so on -- and
     * a stock Piper model carries none of them, so it fails at load with
     * "'sample_rate' does not exist in the metadata". The csukuangfj
     * repositories every other voice here comes from are not mirrors: they are
     * these weights with that metadata added.
     *
     * scripts/patchPiperMeta.py adds it, and the patched model loads and
     * speaks. But the app downloads from modelUrl, and modelUrl serves the
     * unpatched file, so these stay out of the list until there is somewhere
     * to put the patched one. The samples are already rendered from it.
     */
    hidden: true,
    gender,
    sizeBytes: 77_100_232,
    modelUrl: `${BRYCE}/mv2.onnx`,
    /*
     * Lyra's tokens, deliberately. The two models' symbol tables were compared
     * id by id and are the same file's worth of information, and Bryce ships no
     * tokens.txt of his own -- sherpa needs one, and inventing a second copy of
     * a file we already serve is a way for them to drift apart later.
     */
    tokensUrl: `${SHERPA}/vits-piper-en_US-ljspeech-medium/resolve/main/tokens.txt`,
    // The patched file's hash, not Bryce's. Adding metadata changes the bytes.
    modelSha256: 'd687542489c5ed8aaf6a15f39086c974458e10cb8a1b128f16f1531944e50d61',
    speakerId,
    defaultRate: 1,
    licence: 'LibriVox, public domain',
    licenceSource: BRYCE_PAGE,
    licenceAnchor: 'ManyVoice',
  });
});

/** The voices to put in front of someone choosing one. */
export const OFFERED_VOICES: VoiceMeta[] = VOICES.filter((voice) => !voice.hidden);

/** Looks up any voice, offered or not, so a saved choice still resolves. */
export const findVoice = (id: string): VoiceMeta | undefined =>
  VOICES.find((voice) => voice.id === id);
