/**
 * Where synthesised sentences are kept, and which ones go when space runs out.
 *
 * Audio used to be named `s{index}.wav` and nothing else. That name says which
 * sentence but not which book, which voice, or at what speed -- so the only
 * safe thing to do when any of those changed was to delete everything and
 * start again. Which is what happened on every jump, including stepping back a
 * single line.
 *
 * Naming a file after everything that determined its contents removes the
 * ambiguity, and with it the need to wipe. Audio made yesterday is found again
 * today; stepping back plays from disk; and generating a whole book in advance
 * works without any further change, because the files simply accumulate under
 * that book's folder.
 */

export interface AudioKey {
  bookId: number;
  voiceId: string;
  /** Speed is baked into the audio by the engine, so it belongs in the name. */
  rate: number;
  index: number;
}

/** A voice id can be `system:en-us-x-iom-local`, which is not a folder name. */
const safe = (value: string): string => value.replace(/[^a-zA-Z0-9._-]/g, '_');

/**
 * Speed as a folder name.
 *
 * Fixed to two decimals so 1 and 1.0 are one folder rather than two, and so a
 * float that arrives as 1.2000000000000002 does not get one of its own.
 */
const speed = (rate: number): string => (Number.isFinite(rate) ? rate : 1).toFixed(2);

/** Everything belonging to one book, so removing the book removes its audio. */
export const bookDirectory = (root: string, bookId: number): string =>
  `${root}${bookId}/`;

export function audioPath(root: string, key: AudioKey): string {
  return `${bookDirectory(root, key.bookId)}${safe(key.voiceId)}/${speed(key.rate)}/${key.index}.wav`;
}

export interface CachedFile {
  path: string;
  bytes: number;
  /** Last used, as a timestamp. Newer is kept longer. */
  usedAt: number;
}

export interface EvictionRules {
  budgetBytes: number;
  /**
   * Directories that are never evicted -- a book someone chose to download in
   * full. That is not a cache: dropping it would silently undo something they
   * asked for and waited on.
   */
  pinned: string[];
}

/**
 * Which files to delete to get back under budget, least recently used first.
 *
 * Eviction is by size rather than by how far the reader has moved. Tying it to
 * the playhead is what made going back a line expensive: the audio had already
 * been thrown away by the time it was wanted again.
 */
export function evict(files: CachedFile[], rules: EvictionRules): string[] {
  let total = 0;
  for (const file of files) total += file.bytes;
  if (total <= rules.budgetBytes) return [];

  const removable = files
    .filter((file) => !rules.pinned.some((directory) => file.path.startsWith(directory)))
    .sort((a, b) => a.usedAt - b.usedAt);

  const dropped: string[] = [];
  for (const file of removable) {
    if (total <= rules.budgetBytes) break;
    dropped.push(file.path);
    total -= file.bytes;
  }

  return dropped;
}
