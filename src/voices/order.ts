/**
 * The order voices are listed in, and what the phone's own voices are called.
 *
 * Pure, so both are tested. The list used to put installed voices first, which
 * moved everything each time one was downloaded and made the order feel
 * random. Now it never moves.
 */

/**
 * Every voice in the main list, in the order it is listed -- one list to edit,
 * by ear, when the order should change.
 *
 * Lyra, Kristin and Cori first. Then the American voices, a man and a woman
 * in turn, the phone's best ones among the downloadable ones; then British,
 * Australian, and Indian last. Within each, better-sounding earlier as far as
 * anyone has judged -- the phone voices were picked by ear on 2026-10-19, the
 * rest of the order inside a group is a first guess.
 *
 * Phone voices are written as the app saves them: `system:` and the engine's
 * id. A voice not named here is listed after all of these, A to Z.
 */
export const VOICE_ORDER: readonly string[] = [
  'ljspeech-medium', // Lyra
  'en_US-kristin-medium', // Kristin
  'en_GB-cori-medium', // Cori

  'system:en-us-x-iom-local', // Ethan
  'system:en-us-x-iob-local', // Ava
  'manyvoice-6', // Michael
  'manyvoice-13', // Jenny
  'manyvoice-4', // Mike
  'system:en-us-x-tpc-local', // Grace
  'manyvoice-7', // James
  'manyvoice-3', // Maria
  'manyvoice-5', // Mark
  'manyvoice-1', // Kara
  'manyvoice-12', // Paul
  'manyvoice-14', // Emily
  'manyvoice-9', // Wendell

  'system:en-gb-x-gbb-local', // Oliver
  'manyvoice-10', // Steve
  'system:en-gb-x-gbd-local', // Arthur
  'manyvoice-15', // Martin

  'system:en-au-x-aub-local', // Jack
  'system:en-au-x-auc-local', // Charlotte
  'system:en-au-x-aud-local', // Lachlan

  'system:en-in-x-ene-local', // Arjun
];

export function orderCatalog<T extends { id: string; name: string }>(voices: T[]): T[] {
  const rank = (voice: T) => {
    const at = VOICE_ORDER.indexOf(voice.id);
    return at === -1 ? VOICE_ORDER.length : at;
  };
  return [...voices].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/** A phone voice as the system reports it. */
export interface PhoneVoice {
  id: string;
  /** BCP 47, e.g. en-US. */
  locale: string;
}

/** What we call a phone voice we have listened to. */
export interface PhoneVoiceName {
  name: string;
  gender: 'female' | 'male';
  /** How it sounds, in a few words, shown under the name. */
  description: string;
  /** Good enough to list beside the natural voices, not only among the phone's. */
  featured?: boolean;
}

export interface LabelledPhoneVoice<T extends PhoneVoice> {
  voice: T;
  /** "Sophie" for a named voice, "US English · voice 2" for any other. */
  label: string;
  /** "US · female · phone voice", or just "phone voice". */
  detail: string;
  /** The locale's region, upper case: US, GB, AU, IN. Empty when it has none. */
  region: string;
  /** Only for a voice we have named. */
  gender?: 'female' | 'male';
  description?: string;
  featured: boolean;
}

/**
 * Google's per-language alias, `en-US-language`: the language's default voice
 * under a second id. Measured on a phone, its audio is byte-identical to one
 * of the named voices of the same language, so listing it only lists that
 * voice twice.
 */
export function isLanguageAlias(id: string): boolean {
  return /^[a-z]{2}-[A-Z]{2}-language$/.test(id);
}

const ENGLISHES: Record<string, string> = {
  US: 'US English',
  GB: 'UK English',
  IN: 'Indian English',
  AU: 'Australian English',
  CA: 'Canadian English',
  IE: 'Irish English',
  NG: 'Nigerian English',
  ZA: 'South African English',
};

const regionOf = (locale: string): string => (locale.split('-')[1] ?? '').toUpperCase();

/** The accent as the rest of the app writes it: UK, not GB. */
const accentOf = (locale: string): string => {
  const region = regionOf(locale);
  return region === 'GB' ? 'UK' : region;
};

const englishOf = (locale: string): string => {
  const region = (locale.split('-')[1] ?? '').toUpperCase();
  return ENGLISHES[region] ?? (region ? `English (${region})` : 'English');
};

/**
 * Names for the phone's voices, in a fixed order.
 *
 * Android identifies them by codes like `en-us-x-sfg-local`, which tell a
 * listener nothing. The ones we have listened to get a name and a gender;
 * every other one -- another maker's engine, a voice added later -- is
 * numbered within its accent, in a stable order, so the same phone always
 * shows the same names. "phone voice" is always said, so none is mistaken for
 * one of Papervoice's own.
 *
 * This is the list of voices *offered*, so Google's aliases are left out. A
 * saved alias still opens -- that check does not come through here.
 */
export function labelPhoneVoices<T extends PhoneVoice>(
  voices: T[],
  names: Record<string, PhoneVoiceName>,
): Array<LabelledPhoneVoice<T>> {
  const named: Array<LabelledPhoneVoice<T>> = [];
  const unnamed: T[] = [];

  for (const voice of voices) {
    if (isLanguageAlias(voice.id)) continue;
    const known = names[voice.id];
    if (known) {
      const accent = accentOf(voice.locale);
      named.push({
        voice,
        label: known.name,
        detail: `${accent ? `${accent} · ` : ''}${known.gender} · phone voice`,
        region: regionOf(voice.locale),
        gender: known.gender,
        description: known.description,
        featured: known.featured === true,
      });
    } else {
      unnamed.push(voice);
    }
  }

  named.sort((a, b) => a.label.localeCompare(b.label));

  const sorted = [...unnamed].sort(
    (a, b) => a.locale.localeCompare(b.locale) || a.id.localeCompare(b.id),
  );
  const counts = new Map<string, number>();
  const numbered = sorted.map((voice) => {
    const english = englishOf(voice.locale);
    const n = (counts.get(english) ?? 0) + 1;
    counts.set(english, n);
    return {
      voice,
      label: `${english} · voice ${n}`,
      detail: 'phone voice',
      region: regionOf(voice.locale),
      featured: false,
    };
  });

  return [...named, ...numbered];
}
