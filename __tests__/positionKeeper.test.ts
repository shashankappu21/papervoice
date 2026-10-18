import { describe, expect, it } from 'vitest';
import { createPositionKeeper } from '../src/player/positionKeeper';

/**
 * Switching books used to cost both books their place. The final write for
 * the book being left ran after the switch, and read an index that by then
 * belonged to the book being opened: A got B's starting sentence, and going
 * back did the same to B. "Continue listening" lost both.
 */
describe('keeping each book its own place across a switch', () => {
  it('writes the book being left with its own last sentence, not the new book\'s', () => {
    const writes: Array<[number, number]> = [];
    const keeper = createPositionKeeper((bookId, index) => writes.push([bookId, index]));

    keeper.seen(1, 0);
    keeper.opened(1);
    keeper.seen(1, 120); // listened to sentence 120 of book 1
    keeper.seen(2, 0); // book 2 opened: the render has moved on before book 1's last write
    keeper.flush(1); // book 1's final write, on the way out

    expect(writes).toEqual([[1, 120]]);
  });

  it('round trip: A, then B, then back to A keeps both places', () => {
    const writes: Array<[number, number]> = [];
    const keeper = createPositionKeeper((bookId, index) => writes.push([bookId, index]));

    keeper.seen(1, 40);
    keeper.opened(1);
    keeper.seen(1, 120);
    keeper.seen(2, 10);
    keeper.flush(1);
    keeper.opened(2);
    keeper.seen(2, 75);
    keeper.seen(1, 120);
    keeper.flush(2);

    expect(writes).toEqual([
      [1, 120],
      [2, 75],
    ]);
  });

  it('does not write a book back to the place it was opened at', () => {
    const writes: Array<[number, number]> = [];
    const keeper = createPositionKeeper((bookId, index) => writes.push([bookId, index]));

    keeper.seen(3, 55);
    keeper.opened(3);
    keeper.flush(3);
    expect(writes).toEqual([]);
  });

  it('writes again only after the place moves', () => {
    const writes: Array<[number, number]> = [];
    const keeper = createPositionKeeper((bookId, index) => writes.push([bookId, index]));

    keeper.seen(1, 0);
    keeper.opened(1);
    keeper.seen(1, 5);
    keeper.flush(1);
    keeper.flush(1);
    keeper.seen(1, 6);
    keeper.flush(1);
    expect(writes).toEqual([
      [1, 5],
      [1, 6],
    ]);
  });
});
