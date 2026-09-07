/**
 * Turns a sentence as printed into the text a speech engine should receive.
 *
 * This never touches what the reader sees. `Sentence.text` stays exactly as the
 * page set it -- the highlight boxes are aligned to it -- and the spoken form is
 * derived here, used once, and thrown away.
 *
 * The rules are deliberately narrow. Piper's phonemiser already expands digits
 * sensibly ("1.5 million" reads correctly on its own), so this only fixes what
 * it gets wrong: symbols whose spoken position differs from where they are
 * written, and abbreviations it would otherwise spell out letter by letter.
 */

/** Symbols written before the amount but spoken after it. */
const CURRENCY: Record<string, { one: string; many: string }> = {
  $: { one: 'dollar', many: 'dollars' },
  '£': { one: 'pound', many: 'pounds' },
  '€': { one: 'euro', many: 'euros' },
  '₹': { one: 'rupee', many: 'rupees' },
  '¥': { one: 'yen', many: 'yen' },
};

/**
 * A currency symbol, its amount, and any magnitude word belonging to it, so
 * "$1.5 million" is understood as one quantity rather than a symbol followed by
 * an unrelated number.
 */
const AMOUNT =
  /([$£€₹¥])\s?(\d[\d,]*(?:\.\d+)?)(\s+(?:hundred|thousand|million|billion|trillion|lakh|crore))?/g;

/**
 * Currencies written as words rather than symbols, which behave the same way:
 * "Rs. 14,000" is spoken "fourteen thousand rupees".
 */
const WRITTEN_AMOUNT =
  /\b(Rs|INR|USD)\.?\s?(\d[\d,]*(?:\.\d+)?)(\s+(?:hundred|thousand|million|billion|trillion|lakh|crore))?/gi;

const WRITTEN_CURRENCY: Record<string, { one: string; many: string }> = {
  rs: { one: 'rupee', many: 'rupees' },
  inr: { one: 'rupee', many: 'rupees' },
  usd: { one: 'dollar', many: 'dollars' },
};

const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\be\.g\.(?=\s|$)/g, 'for example'],
  [/\bi\.e\.(?=\s|$)/g, 'that is'],
  // Matches the letters only, so the full stop stays: it may be ending the
  // sentence as well as the abbreviation.
  [/\betc(?=\.)/g, 'et cetera'],
  [/\bvs(?=\.)/g, 'versus'],
  [/\bDr\.(?=\s)/g, 'Doctor'],
  [/\bMr\.(?=\s)/g, 'Mister'],
  [/\bMrs\.(?=\s)/g, 'Missus'],
  [/\bProf\.(?=\s)/g, 'Professor'],
];

export function speakable(text: string): string {
  let out = text.replace(AMOUNT, (_all, symbol: string, digits: string, magnitude?: string) => {
    const unit = CURRENCY[symbol];
    const singular = digits === '1' && !magnitude;
    return `${digits}${magnitude ?? ''} ${singular ? unit.one : unit.many}`;
  });

  out = out.replace(WRITTEN_AMOUNT, (_all, word: string, digits: string, magnitude?: string) => {
    const unit = WRITTEN_CURRENCY[word.toLowerCase()];
    const singular = digits === '1' && !magnitude;
    return `${digits}${magnitude ?? ''} ${singular ? unit.one : unit.many}`;
  });

  // Quotation marks are for the eye. A reader conveys speech by delivery, never
  // by saying the marks, and an engine handed them makes a sound for them. Only
  // the double-quote family goes: the single ones are apostrophes far more
  // often than quotes, and losing those would turn "don't" into "dont".
  out = out.replace(/[“”„«»"]/g, '');

  // An exclamation is delivered as alarm, which is exhausting across a book and
  // sounds like a fright rather than emphasis. The sentence still ends.
  out = out.replace(/!+/g, '.');

  // A percentage is spoken where it is written; only the symbol itself has no
  // pronunciation.
  out = out.replace(/(\d)\s?%/g, '$1 percent');

  out = out.replace(/\s&\s/g, ' and ');

  // A dash between two numbers is a range and is read as one -- but only if it
  // runs upwards. "House Document 110-50" is a single number, and reading it as
  // "110 to 50" is nonsense. Between words a dash is punctuation, a pause, and
  // is left alone either way.
  out = out.replace(/(\d+)\s?[–—-]\s?(\d+)/g, (all, from: string, to: string) =>
    Number(to) > Number(from) ? `${from} to ${to}` : all,
  );

  // A dash standing between phrases is a pause a writer chose. espeak-ng
  // ignores the character outright, so the sentence runs straight on unless the
  // break is given to it as punctuation it reads: a comma pauses without
  // resetting the intonation the way a full stop would. Ranges have already
  // been rewritten above, and a hyphen inside a word is left alone.
  out = out.replace(/\s*—\s*/g, ', ');
  out = out.replace(/\s+[–-]\s+/g, ', ');

  for (const [pattern, replacement] of ABBREVIATIONS) {
    out = out.replace(pattern, replacement);
  }

  return out.replace(/\s{2,}/g, ' ').trim();
}
