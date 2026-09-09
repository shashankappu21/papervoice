import { describe, expect, it } from 'vitest';
import {
  clampRate,
  fractionToRate,
  rateToFraction,
  snapRate,
  RATE_LIMITS,
  RATE_PRESETS,
} from '../src/player/rate';

describe('clampRate', () => {
  it('keeps a speed inside what the engine accepts', () => {
    expect(clampRate(0.1)).toBe(RATE_LIMITS.min);
    expect(clampRate(9)).toBe(RATE_LIMITS.max);
    expect(clampRate(1.4)).toBe(1.4);
  });

  it('survives a corrupt stored rate', () => {
    expect(clampRate(Number.NaN)).toBe(1);
  });
});

describe('snapRate', () => {
  it('rounds to a tenth', () => {
    expect(snapRate(1.43)).toBe(1.4);
    expect(snapRate(1.46)).toBe(1.5);
  });

  it('pulls onto a preset when very close', () => {
    // A drag landing on 1.02 should read and run as exactly 1x. Showing "1.0×"
    // while running at 1.02 is the sort of small lie that makes a control feel
    // broken.
    expect(snapRate(1.02)).toBe(1);
    expect(snapRate(0.98)).toBe(1);
    expect(snapRate(1.48)).toBe(1.5);
  });

  it('does not drag a genuinely different speed onto a preset', () => {
    expect(snapRate(1.2)).toBe(1.2);
    expect(snapRate(1.7)).toBe(1.7);
  });
});

describe('the slider mapping', () => {
  it('puts the ends of the range at the ends of the track', () => {
    expect(rateToFraction(RATE_LIMITS.min)).toBe(0);
    expect(rateToFraction(RATE_LIMITS.max)).toBe(1);
  });

  it('round-trips a speed through the track', () => {
    for (const rate of [0.5, 1, 1.5, 2, 3]) {
      expect(fractionToRate(rateToFraction(rate))).toBeCloseTo(rate, 5);
    }
  });

  it('holds a drag inside the track', () => {
    expect(fractionToRate(-3)).toBe(RATE_LIMITS.min);
    expect(fractionToRate(4)).toBe(RATE_LIMITS.max);
    expect(fractionToRate(Number.NaN)).toBe(RATE_LIMITS.min);
  });

  it('offers presets the engine can actually play', () => {
    for (const preset of RATE_PRESETS) {
      expect(preset).toBeGreaterThanOrEqual(RATE_LIMITS.min);
      expect(preset).toBeLessThanOrEqual(RATE_LIMITS.max);
    }
  });
});
