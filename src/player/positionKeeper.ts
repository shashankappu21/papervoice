/**
 * Which sentence to save for which book.
 *
 * The place is remembered per book, not as one shared "current index". The
 * final save for a book being left happens after the switch has already
 * rendered, when the shared index belonged to the book being opened -- so A
 * was saved at B's starting sentence and fell out of "Continue listening",
 * and going back did the same to B.
 *
 * Pure: the hook around it decides when to call these.
 */
export interface PositionKeeper {
  /** The place shown for a book at this render. */
  seen(bookId: number, index: number): void;
  /** A book was opened at the place last seen for it, which is already saved. */
  opened(bookId: number): void;
  /** Saves the book's last place, if it moved since the last save. */
  flush(bookId: number): void;
}

export function createPositionKeeper(save: (bookId: number, index: number) => void): PositionKeeper {
  const last = new Map<number, number>();
  const saved = new Map<number, number>();

  return {
    seen(bookId, index) {
      last.set(bookId, index);
    },
    opened(bookId) {
      const index = last.get(bookId);
      if (index !== undefined) saved.set(bookId, index);
    },
    flush(bookId) {
      const index = last.get(bookId);
      if (index === undefined || saved.get(bookId) === index) return;
      saved.set(bookId, index);
      save(bookId, index);
    },
  };
}
