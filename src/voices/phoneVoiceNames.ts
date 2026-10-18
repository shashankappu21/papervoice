import type { PhoneVoiceName } from './order';

/**
 * Names for phone voices we have actually listened to, keyed by the exact id
 * Android reports (TextToSpeech's Voice.getName()).
 *
 * Filled in by ear, on a real phone -- never guessed from the code in the id,
 * which says nothing reliable about who is speaking. A voice missing from here
 * is still offered, numbered within its accent.
 */
export const PHONE_VOICE_NAMES: Record<string, PhoneVoiceName> = {};
