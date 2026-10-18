import { describe, expect, it } from 'vitest';
import { add, dueForWrite, flush, playedBetween, total } from '../src/stats/listening';

describe('counting listening time', () => {
  it('counts the time between two playing reports', () => {
    expect(playedBetween(1_000, 1_500)).toBe(0.5);
  });

  it('counts nothing for the first report of a stretch', () => {
    expect(playedBetween(null, 1_500)).toBe(0);
  });

  it('does not count a long gap, such as the phone sleeping', () => {
    expect(playedBetween(1_000, 61_000)).toBe(0);
    expect(playedBetween(5_000, 1_000)).toBe(0);
  });

  it('writes only every half minute, and keeps the total exact', () => {
    let counter = { stored: 100, pending: 0 };
    counter = add(counter, 20);
    expect(dueForWrite(counter)).toBe(false);
    counter = add(counter, 12);
    expect(dueForWrite(counter)).toBe(true);
    expect(total(counter)).toBe(132);

    const written = flush(counter);
    expect(written.total).toBe(132);
    expect(written.counter).toEqual({ stored: 132, pending: 0 });
  });
});
