import { describe, expect, it } from 'vitest';
import { nextRate, RATE_STEPS } from '../src/player/rate';

describe('nextRate', () => {
  it('steps to the next speed', () => {
    expect(nextRate(1)).toBe(1.2);
    expect(nextRate(1.2)).toBe(1.5);
  });

  it('wraps round at the top', () => {
    expect(nextRate(RATE_STEPS[RATE_STEPS.length - 1])).toBe(RATE_STEPS[0]);
  });

  it('snaps a speed that sits between steps', () => {
    // Speeds like these were reachable with the old plus and minus buttons.
    // Each snaps to the step nearest it and moves on from there, rather than
    // falling back to the start of the list. Values exactly halfway between
    // two steps are avoided here on purpose: which one wins is a matter of
    // floating point, and pinning it down would be testing arithmetic.
    expect(nextRate(1.13)).toBe(1.5);
    expect(nextRate(0.95)).toBe(1.2);
  });

  it('survives a corrupt stored rate', () => {
    expect(nextRate(Number.NaN)).toBe(RATE_STEPS[0]);
  });
});
