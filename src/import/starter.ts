/**
 * The book a new install starts with, and whether it still needs importing.
 *
 * Only a library created from nothing gets it: the schema marks the state
 * `pending` on the first ever launch, so someone updating from an older
 * version keeps exactly the library they had. Importing reuses the ordinary
 * pipeline; if it fails, it is tried again on later launches, a few times,
 * and then quietly left alone -- a starter book is a welcome, not a promise.
 */

export const STARTER_STATE = 'starter.state';
export const STARTER_BOOK_ID = 'starter.bookId';
export const STARTER_TITLE = 'Three Stories by O. Henry';
export const STARTER_ATTEMPTS = 3;

/** pending · failed:<n> · done · gave-up. Anything else, including none, means leave it. */
export function shouldImport(state: string | null): boolean {
  if (state === 'pending') return true;
  const failed = /^failed:(\d+)$/.exec(state ?? '');
  return failed !== null && Number(failed[1]) < STARTER_ATTEMPTS;
}

export function afterFailure(state: string | null): string {
  const failed = /^failed:(\d+)$/.exec(state ?? '');
  const attempts = (failed ? Number(failed[1]) : 0) + 1;
  return attempts >= STARTER_ATTEMPTS ? 'gave-up' : `failed:${attempts}`;
}

/** Shown on the starter book until it has been opened once. */
export function showsStartHere(
  book: { id: number; addedAt: number; lastOpenedAt: number | null },
  starterId: number | null,
): boolean {
  return starterId === book.id && book.lastOpenedAt === book.addedAt;
}
