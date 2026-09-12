/**
 * Comparing what a phonemiser produces against what a model can accept.
 *
 * This exists because of a wrong answer that survived two sessions. The Kitten
 * voices mispronounce "judge" and "church", and the explanation offered was
 * that their token map contains symbols eSpeak cannot emit. It was arrived at
 * by reasoning about phoneme alphabets rather than by dumping the tokens and
 * looking, and it was wrong: KittenTTS's own reference implementation requires
 * eSpeak. The real fault is narrower and only visible in the bytes -- the
 * reference emits the ligatures U+02A4 and U+02A7, while the phonemiser we call
 * emits two characters each, so those tokens are never reached.
 *
 * A difference of that shape is not something to have an opinion about. It is
 * two sets and a subtraction, which is all this file is.
 */

/** `symbol id` per line, with a literal space written as an empty first field. */
export function parseTokens(text: string): Map<number, string> {
  const tokens = new Map<number, string>();
  for (const line of text.split('\n')) {
    if (!line) continue;
    const parts = line.replace(/\r$/, '').split(' ');
    // "  32" -- the symbol is a space, so splitting leaves an empty field first.
    if (parts.length === 3 && parts[0] === '') tokens.set(Number(parts[2]), ' ');
    else if (parts.length === 2) tokens.set(Number(parts[1]), parts[0]);
  }
  return tokens;
}

/** Piper's config stores the same thing the other way round: symbol -> [ids]. */
export function parsePhonemeIdMap(map: Record<string, number[]>): Map<number, string> {
  const tokens = new Map<number, string>();
  for (const [symbol, ids] of Object.entries(map)) {
    for (const id of ids) tokens.set(id, symbol);
  }
  return tokens;
}

export interface MapDiff {
  /** Ids present in both, holding different symbols. The dangerous kind. */
  conflicting: Array<{ id: number; a: string; b: string }>;
  onlyInA: number[];
  onlyInB: number[];
  identical: boolean;
}

/**
 * Whether two models can share one phonemiser.
 *
 * `conflicting` is the field that matters and the reason this returns ids
 * rather than a boolean: a model whose id 42 means something else does not
 * fail, it speaks -- wrongly, in a way that sounds like a bad voice rather than
 * a wiring mistake. Counting matching symbols would hide exactly that.
 */
export function diffTokenMaps(a: Map<number, string>, b: Map<number, string>): MapDiff {
  const conflicting: MapDiff['conflicting'] = [];
  const onlyInA: number[] = [];
  const onlyInB: number[] = [];

  for (const [id, symbol] of a) {
    if (!b.has(id)) onlyInA.push(id);
    else if (b.get(id) !== symbol) conflicting.push({ id, a: symbol, b: b.get(id)! });
  }
  for (const id of b.keys()) if (!a.has(id)) onlyInB.push(id);

  return {
    conflicting,
    onlyInA,
    onlyInB,
    identical: conflicting.length === 0 && onlyInA.length === 0 && onlyInB.length === 0,
  };
}

export interface Coverage {
  /** Symbols the phonemiser produced that the model has no token for. */
  unmappable: string[];
  /** Tokens the model has that this sample never reached. Not a fault. */
  unreached: string[];
  covered: number;
  total: number;
}

/**
 * What a model would actually do with a phonemiser's output.
 *
 * Splitting by code point rather than by grapheme is the whole point: it is
 * what makes "dʒ" and "ʤ" visibly different rather than both reading as
 * "the j sound". The bug being chased hides in exactly that distinction.
 */
export function coverage(phonemes: string, tokens: Map<number, string>): Coverage {
  const known = new Set(tokens.values());
  const used = new Set<string>();
  const unmappable = new Set<string>();

  for (const symbol of [...phonemes]) {
    if (known.has(symbol)) used.add(symbol);
    else unmappable.add(symbol);
  }

  return {
    unmappable: [...unmappable].sort(),
    unreached: [...known].filter((symbol) => !used.has(symbol)).sort(),
    covered: used.size,
    total: used.size + unmappable.size,
  };
}

/** How a symbol should be written in a report, so a diff is readable. */
export const describe = (symbol: string): string =>
  `${JSON.stringify(symbol)} (${[...symbol]
    .map((c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`)
    .join(' ')})`;
