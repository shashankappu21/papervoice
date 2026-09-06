/**
 * Breaks one utterance into pieces a speech engine can synthesise promptly.
 *
 * Some sentences are very long -- an index entry runs to a thousand characters
 * of page numbers -- and a synthesiser works through one of those as a single
 * job. The queue then stalls behind it and the highlight sits still, so a long
 * sentence is cut at the strongest boundary that fits.
 *
 * Cutting is by character count rather than by anything cleverer because
 * synthesis time tracks the length of the text, not its meaning.
 */

/** Boundaries to break at, strongest first: each is spoken with a pause anyway. */
const BOUNDARIES = [/[;:]\s/g, /,\s/g, /\s[–—]\s/g, /\s/g];

export function chunk(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];

  const pieces: string[] = [];
  let rest = text;

  while (rest.length > limit) {
    const cut = findCut(rest, limit);
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest.length > 0) pieces.push(rest);

  return pieces;
}

/**
 * The end of the last boundary at or before `limit`. Later is better: it keeps
 * the pieces few and their phrasing whole.
 */
function findCut(text: string, limit: number): number {
  const window = text.slice(0, limit + 1);

  for (const boundary of BOUNDARIES) {
    let cut = -1;
    boundary.lastIndex = 0;
    for (let match = boundary.exec(window); match; match = boundary.exec(window)) {
      cut = match.index + match[0].length;
    }
    if (cut > 0) return cut;
  }

  // A single unbroken run longer than the limit -- a URL, a long number. It has
  // to be cut somewhere, and cutting at the limit at least keeps the pieces even.
  return limit;
}
