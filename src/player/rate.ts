/** What the engine will accept, and the granularity the slider moves in. */
export const RATE_LIMITS = { min: 0.5, max: 3, step: 0.1 } as const;

/**
 * The speeds worth one tap.
 *
 * A slider alone is fiddly for the values people actually want -- almost
 * everyone wants exactly 1x or exactly 1.5x, and hitting those by dragging is
 * luck. The presets make the common choices exact and leave the slider for the
 * rest.
 */
export const RATE_PRESETS = [0.8, 1, 1.25, 1.5, 2, 2.5] as const;

/** Keeps a speed inside what the engine accepts, including from a corrupt store. */
export function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1;
  return Math.min(RATE_LIMITS.max, Math.max(RATE_LIMITS.min, rate));
}

/**
 * Snaps to the nearest tenth, and to a preset when very close to one.
 *
 * A drag that lands on 1.02 should read as 1x. Without this the label shows
 * "1.0×" while the engine runs at 1.02, which is the kind of small dishonesty
 * that makes a control feel broken.
 */
export function snapRate(rate: number): number {
  const clamped = clampRate(rate);

  for (const preset of RATE_PRESETS) {
    if (Math.abs(clamped - preset) < 0.04) return preset;
  }

  return Math.round(clamped * 10) / 10;
}

/** Where a speed sits along the slider, from 0 to 1. */
export function rateToFraction(rate: number): number {
  const { min, max } = RATE_LIMITS;
  return (clampRate(rate) - min) / (max - min);
}

/** The speed at a point along the slider. */
export function fractionToRate(fraction: number): number {
  const { min, max } = RATE_LIMITS;
  const bounded = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
  return snapRate(min + bounded * (max - min));
}
