/**
 * The short recording of each voice, bundled with the app.
 *
 * A voice cannot be heard before it is downloaded, and downloading 63MB to
 * find out you dislike it is a bad trade. So every voice says one fixed
 * sentence here, rendered once on a desktop by scripts/makeVoiceSamples.py.
 *
 * The requires are written out rather than built from the voice id, because
 * Metro resolves them when it bundles: a path put together at runtime is not
 * a path it can see, and the asset would simply not be included.
 */

/** What every sample says. Shown beside the play button so it is not a mystery. */
export const SAMPLE_SENTENCE = 'She paused, then asked: how far is it? About three miles.';

const SAMPLES: Record<string, number> = {
  'ljspeech-medium': require('../../assets/samples/ljspeech-medium.opus'),
  'en_US-kristin-medium': require('../../assets/samples/en_US-kristin-medium.opus'),
  'en_US-norman-medium': require('../../assets/samples/en_US-norman-medium.opus'),
  'en_US-john-medium': require('../../assets/samples/en_US-john-medium.opus'),
  'en_GB-cori-medium': require('../../assets/samples/en_GB-cori-medium.opus'),
  'en_US-ryan-medium': require('../../assets/samples/en_US-ryan-medium.opus'),
  'en_US-hfc_female-medium': require('../../assets/samples/en_US-hfc_female-medium.opus'),
  'en_US-hfc_male-medium': require('../../assets/samples/en_US-hfc_male-medium.opus'),
  'en_GB-miro-high': require('../../assets/samples/en_GB-miro-high.opus'),
  'en_US-miro-high': require('../../assets/samples/en_US-miro-high.opus'),
  'en_GB-dii-high': require('../../assets/samples/en_GB-dii-high.opus'),
  'kitten-nano-0': require('../../assets/samples/kitten-nano-0.opus'),
  'kitten-nano-2': require('../../assets/samples/kitten-nano-2.opus'),
  'kitten-nano-3': require('../../assets/samples/kitten-nano-3.opus'),
  'kitten-nano-4': require('../../assets/samples/kitten-nano-4.opus'),
  'kitten-nano-5': require('../../assets/samples/kitten-nano-5.opus'),
  'kitten-nano-7': require('../../assets/samples/kitten-nano-7.opus'),

  // ManyVoice: one 77MB download, one sample per speaker in it.
  'manyvoice-0': require('../../assets/samples/manyvoice-0.opus'),
  'manyvoice-1': require('../../assets/samples/manyvoice-1.opus'),
  'manyvoice-2': require('../../assets/samples/manyvoice-2.opus'),
  'manyvoice-3': require('../../assets/samples/manyvoice-3.opus'),
  'manyvoice-4': require('../../assets/samples/manyvoice-4.opus'),
  'manyvoice-5': require('../../assets/samples/manyvoice-5.opus'),
  'manyvoice-6': require('../../assets/samples/manyvoice-6.opus'),
  'manyvoice-7': require('../../assets/samples/manyvoice-7.opus'),
  'manyvoice-9': require('../../assets/samples/manyvoice-9.opus'),
  'manyvoice-10': require('../../assets/samples/manyvoice-10.opus'),
  'manyvoice-12': require('../../assets/samples/manyvoice-12.opus'),
  'manyvoice-13': require('../../assets/samples/manyvoice-13.opus'),
  'manyvoice-14': require('../../assets/samples/manyvoice-14.opus'),
  'manyvoice-15': require('../../assets/samples/manyvoice-15.opus'),
};

/** The bundled recording for a voice, or null where one was never made. */
export function sampleFor(voiceId: string): number | null {
  return SAMPLES[voiceId] ?? null;
}

/** Which voices have one, so the catalog and this file can be checked against each other. */
export const SAMPLED_VOICE_IDS = Object.keys(SAMPLES);
