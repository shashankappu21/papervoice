import type { PhoneVoiceName } from './order';

/**
 * Names for phone voices we have actually listened to, keyed by the exact id
 * Android reports (TextToSpeech's Voice.getName()).
 *
 * Filled in by ear, on a real phone -- never guessed from the code in the id,
 * which says nothing reliable about who is speaking. A voice missing from here
 * is still offered, numbered within its accent.
 *
 * Google's voices on a realme RMX3031, 2026-10-19: all 28 were heard, and
 * `scripts/phoneVoices.mjs` matched each label in the Voices tab to its id.
 * Gender was measured from each sample's pitch and confirmed by ear where the
 * pitch was ambiguous (ene, tpc); the descriptions come from the same
 * measurements -- pitch, how much it moves, how fast the sentence goes.
 *
 * `featured` ones were judged good enough to list beside the natural voices.
 * The rest of the named ones are fine but no better; the unnamed ones sound
 * robotic, and are named nothing on purpose -- a name reads as a
 * recommendation.
 */
export const PHONE_VOICE_NAMES: Record<string, PhoneVoiceName> = {
  'en-au-x-aub-local': { name: 'Jack', gender: 'male', description: 'Light and even', featured: true },
  'en-au-x-aud-local': { name: 'Lachlan', gender: 'male', description: 'Light and steady', featured: true },
  'en-au-x-auc-local': { name: 'Charlotte', gender: 'female', description: 'Bright and lively', featured: true },
  'en-gb-x-gbb-local': { name: 'Oliver', gender: 'male', description: 'Expressive and unhurried', featured: true },
  'en-gb-x-gbd-local': { name: 'Arthur', gender: 'male', description: 'Low, slow and measured', featured: true },
  'en-in-x-ene-local': { name: 'Arjun', gender: 'male', description: 'Bright and expressive', featured: true },
  'en-us-x-iob-local': { name: 'Ava', gender: 'female', description: 'Expressive and unhurried', featured: true },
  'en-us-x-tpc-local': { name: 'Grace', gender: 'female', description: 'Low and expressive', featured: true },
  'en-us-x-iom-local': { name: 'Ethan', gender: 'male', description: 'Lively but unhurried', featured: true },

  'en-gb-x-gbg-local': { name: 'Harriet', gender: 'female', description: 'Bright and very lively' },
  'en-us-x-tpd-local': { name: 'Daniel', gender: 'male', description: 'Light and unhurried' },
};
