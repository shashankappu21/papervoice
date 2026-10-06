/**
 * How far through a book someone is, and what that means for the library.
 *
 * Pure, so it is tested without a database or a device. Only the three fields
 * the decision needs, so a test does not have to build a whole Book.
 */
export interface Progress {
  /** The saved sentence. */
  position: number;
  sentenceCount: number;
  /** When the last sentence last finished playing, or null if it never has. */
  finishedAt: number | null;
}

/**
 * Finished, and not yet started again.
 *
 * Finishing writes the position back to zero. The last sentence counts too,
 * because the position is also saved on a five-second timer, and that timer
 * can land just after the finish and write the final sentence back. Judging
 * by the data rather than by which write won makes that race harmless: a
 * finished book sitting on its last sentence is still finished.
 *
 * Anywhere in between means it has been started again, and then it is in
 * progress like any other book.
 */
export function isFinished(book: Progress): boolean {
  if (book.finishedAt === null) return false;
  return book.position <= 0 || book.position >= book.sentenceCount - 1;
}

/** Belongs under "Continue listening": started, and not finished. */
export function isInProgress(book: Progress): boolean {
  return book.position > 0 && !isFinished(book);
}

/** Where opening the book should begin: the start, once it has been finished. */
export function resumeIndex(book: Progress): number {
  return isFinished(book) ? 0 : Math.max(0, book.position);
}

/** The prefix in the library list: "Finished · ", "42% · ", or nothing yet. */
export function progressLabel(book: Progress): string {
  if (isFinished(book)) return 'Finished · ';
  if (book.position <= 0) return '';
  return `${percentRead(book)}% · `;
}

export function percentRead(book: Progress): number {
  return Math.round((book.position / Math.max(1, book.sentenceCount)) * 100);
}
