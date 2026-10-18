/**
 * The order voices are listed in, and what the phone's own voices are called.
 *
 * Pure, so both are tested. The list used to put installed voices first, which
 * moved everything each time one was downloaded and made the order feel
 * random. Now it never moves: a short recommended group, then A to Z.
 */

/** Listed first, in this order: the voices most people should try first. */
export const RECOMMENDED = ['ljspeech-medium', 'en_US-kristin-medium', 'en_GB-cori-medium'];

export function orderCatalog<T extends { id: string; name: string }>(voices: T[]): T[] {
  const rank = (voice: T) => {
    const at = RECOMMENDED.indexOf(voice.id);
    return at === -1 ? RECOMMENDED.length : at;
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
}

export interface LabelledPhoneVoice<T extends PhoneVoice> {
  voice: T;
  /** "Sophie" for a named voice, "US English · voice 2" for any other. */
  label: string;
  /** "US · female · phone voice", or just "phone voice". */
  detail: string;
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

/** The accent as the rest of the app writes it: UK, not GB. */
const accentOf = (locale: string): string => {
  const region = (locale.split('-')[1] ?? '').toUpperCase();
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
 */
export function labelPhoneVoices<T extends PhoneVoice>(
  voices: T[],
  names: Record<string, PhoneVoiceName>,
): Array<LabelledPhoneVoice<T>> {
  const named: Array<LabelledPhoneVoice<T>> = [];
  const unnamed: T[] = [];

  for (const voice of voices) {
    const known = names[voice.id];
    if (known) {
      const accent = accentOf(voice.locale);
      named.push({
        voice,
        label: known.name,
        detail: `${accent ? `${accent} · ` : ''}${known.gender} · phone voice`,
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
    return { voice, label: `${english} · voice ${n}`, detail: 'phone voice' };
  });

  return [...named, ...numbered];
}
