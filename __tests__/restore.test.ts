import { describe, expect, it } from 'vitest';
import { bookToRestore } from '../src/player/restore';

const opened = { id: 4, lastOpenedAt: 1_700_000_000_000 };

describe('the book put back on the bar at launch', () => {
  it('is the one that was there when the app last ran', () => {
    expect(bookToRestore('9', opened)).toBe(9);
  });

  it('is nothing when the bar was closed on purpose', () => {
    // The close button has to mean something across a restart.
    expect(bookToRestore('', opened)).toBeNull();
  });

  it('falls back to the most recently opened book on an older install', () => {
    expect(bookToRestore(null, opened)).toBe(4);
  });

  it('is nothing when no book has ever been opened', () => {
    expect(bookToRestore(null, null)).toBeNull();
    expect(bookToRestore(null, { id: 4, lastOpenedAt: null })).toBeNull();
  });

  it('ignores a stored value that is not a book id', () => {
    for (const stored of ['0', '-3', '2.5', 'abc']) {
      expect(bookToRestore(stored, opened)).toBeNull();
    }
  });
});
