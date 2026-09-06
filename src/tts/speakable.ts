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

  for (const [pattern, replacement] of ABBREVIATIONS) {
    out = out.replace(pattern, replacement);
  }

  return out.replace(/\s{2,}/g, ' ').trim();
}
