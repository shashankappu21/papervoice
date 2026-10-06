/**
 * Which book to put back on the bar when the app starts cold.
 *
 * Kept pure so the rule is tested without a database.
 *
 * The stored value has three states, and they mean different things:
 *
 *   a book id   that book was on the bar when the app last ran
 *   ''          the bar was closed on purpose -- respect that, show nothing
 *   null        never written: an install from before this existed, so the
 *               most recently opened book is the best guess there is
 *
 * The middle case is the one that matters. The mini player has a close button,
 * and a book someone dismissed reappearing on every launch would make it a
 * button that does nothing.
 */
export function bookToRestore(
  stored: string | null,
  mostRecentlyOpened: { id: number; lastOpenedAt: number | null } | null,
): number | null {
  if (stored === '') return null;

  if (stored !== null) {
    const id = Number(stored);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  // Never opened means never read, which is not something to resume.
  if (!mostRecentlyOpened || mostRecentlyOpened.lastOpenedAt === null) return null;
  return mostRecentlyOpened.id;
}
