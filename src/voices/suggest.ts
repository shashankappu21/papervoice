/**
 * Which voice might suit a book, from its text alone.
 *
 * On the phone, from words already extracted, so nothing about the book goes
 * anywhere. Deliberately simple rules over things a text says plainly --
 * dialogue, figures and citations, numbers and codes, British or American
 * spelling -- and nothing it does not: not the narrator's gender, not the mood,
 * not Indian English, whose spelling is British. It only ever suggests; it
 * never changes the voice. Checked against real books by
 * `node --no-warnings scripts/checkSuggestions.mjs`.
 *
 * Pure and free of imports, so Node can run it straight from the source.
 */

export type BookKind = 'story' | 'study' | 'form' | 'unknown';

export interface BookProfile {
  kind: BookKind;
  /** GB or US when the spelling says so clearly, otherwise null. */
  spelling: 'GB' | 'US' | null;
}

/** Fewer words than this and there is nothing to go on. */
const MIN_WORDS = 150;

const SPEECH = /\b(said|asked|replied|cried|whispered|answered|exclaimed|shouted|muttered|called)\b/g;
const THIRD_PERSON = /\b(he|she|him|her|his|hers)\b/g;
const STUDY = new RegExp(
  [
    'figures?', 'fig\\.', 'tables?', 'sections?', 'et al', 'e\\.g\\.', 'i\\.e\\.', 'analysis', 'data',
    'results', 'research', 'percent', 'assignment', 'module', 'students?', 'exercise', 'definition',
    'objectives?', 'methods?', 'theory', 'example',
  ]
    .map((word) => `\\b${word}`)
    .join('|'),
  'g',
);
/** Words every English passage uses; placeholder text and scans of codes have few. */
const COMMON = /\b(the|and|of|to|a|in|that|was|is|it|for|with)\b/g;

const UK = /\b(colours?|favour(ite|ed|s)?|honour(ed|s)?|behaviour|neighbour(s|hood)?|labour|centre|theatre|realis(e|ed|es|ing)|organis(e|ed|ation)|recognis(e|ed)|apologis(e|ed)|grey|travell(ed|ing)|whilst|programme|defence|catalogue)\b/g;
const US = /\b(colors?|favor(ite|ed|s)?|honor(ed|s)?|behavior|neighbor(s|hood)?|labor|center|theater|realiz(e|ed|es|ing)|organiz(e|ed|ation)|recogniz(e|ed)|apologiz(e|ed)|gray|travel(ed|ing)|defense|catalog)\b/g;

const count = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length;

export function profileText(raw: string): BookProfile {
  const text = raw.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const n = words.length;
  if (n < MIN_WORDS) return { kind: 'unknown', spelling: null };

  const uk = count(text, UK);
  const us = count(text, US);
  const spelling = uk >= 2 && uk >= 2 * us ? 'GB' : us >= 2 && us >= 2 * uk ? 'US' : null;

  // A form first: tickets and bills are mostly codes and numbers, so they
  // would fail the everyday-words check below as surely as placeholder text.
  const numbers = words.filter((word) => /\d/.test(word)).length / n;
  const sentences = Math.max(1, (raw.match(/[.!?](\s|$)/g) ?? []).length);
  if (numbers > 0.15 && n / sentences < 9) return { kind: 'form', spelling };

  const per1000 = (hits: number) => (hits * 1000) / n;
  if (per1000(count(text, COMMON)) < 60) return { kind: 'unknown', spelling };

  const storyScore = per1000(count(text, SPEECH)) * 3 + per1000(count(text, THIRD_PERSON)) * 0.3;
  // Research words weigh most: non-fiction tells stories too, but novels
  // almost never say data, analysis or example (at most 1.2 per thousand words
  // across five classics, against 3.5 in a negotiation book).
  const studyScore = per1000(count(text, STUDY)) * 6 + numbers * 100;
  return { kind: storyScore > studyScore ? 'story' : 'study', spelling };
}

/**
 * Who to suggest for each kind of book, best first. Phone voices are written
 * as the app saves them; one this phone does not have is skipped.
 */
const CANDIDATES: Record<Exclude<BookKind, 'unknown'>, Record<'GB' | 'US' | 'any', string[]>> = {
  story: {
    GB: ['system:en-gb-x-gbb-local', 'en_GB-cori-medium', 'manyvoice-10'], // Oliver, Cori, Steve
    US: ['ljspeech-medium', 'system:en-us-x-iom-local', 'system:en-us-x-iob-local'], // Lyra, Ethan, Ava
    any: ['ljspeech-medium', 'system:en-us-x-iom-local', 'en_GB-cori-medium'], // Lyra, Ethan, Cori
  },
  study: {
    GB: ['system:en-gb-x-gbd-local', 'en_GB-cori-medium', 'manyvoice-15'], // Arthur, Cori, Martin
    US: ['en_US-kristin-medium', 'manyvoice-6', 'manyvoice-12'], // Kristin, Michael, Paul
    any: ['en_US-kristin-medium', 'manyvoice-6', 'manyvoice-12'],
  },
  form: {
    GB: ['en_US-kristin-medium', 'manyvoice-6'],
    US: ['en_US-kristin-medium', 'manyvoice-6'],
    any: ['en_US-kristin-medium', 'manyvoice-6'],
  },
};

const REASONS: Record<Exclude<BookKind, 'unknown'>, { GB: string; other: string }> = {
  story: {
    GB: 'A British story with plenty of dialogue',
    other: 'A story with plenty of dialogue suits an expressive storyteller',
  },
  study: {
    GB: 'Factual writing with British spelling reads best in a steady voice',
    other: 'Factual writing reads best in a steady voice',
  },
  form: { GB: 'Short, form-like text needs a clear, steady voice', other: 'Short, form-like text needs a clear, steady voice' },
};

/** Up to two voices for this book, from those `offered` says this phone has; null when there is no telling. */
export function suggestVoices(
  profile: BookProfile,
  offered: (voiceId: string) => boolean,
): { voiceIds: string[]; reason: string } | null {
  if (profile.kind === 'unknown') return null;
  const voiceIds = CANDIDATES[profile.kind][profile.spelling ?? 'any'].filter(offered).slice(0, 2);
  if (voiceIds.length === 0) return null;
  return { voiceIds, reason: REASONS[profile.kind][profile.spelling === 'GB' ? 'GB' : 'other'] };
}
