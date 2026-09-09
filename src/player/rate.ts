/**
 * The speeds the pill cycles through.
 *
 * A tappable pill replaces the old minus and plus buttons: two controls that
 * each moved by 0.1 meant eight taps to get from 1x to 1.8x. These are the
 * speeds people actually choose, and one tap moves between them.
 */
export const RATE_STEPS = [0.8, 1, 1.2, 1.5, 1.8, 2.2, 2.6, 3] as const;

/**
 * The next speed after this one.
 *
 * The current rate may sit between steps -- it was saved by the old buttons, or
 * by an earlier version of this list -- so it snaps to the nearest step first
 * and moves on from there, rather than falling back to the beginning.
 */
export function nextRate(current: number): number {
  if (!Number.isFinite(current)) return RATE_STEPS[0];

  let nearest = 0;
  for (let i = 1; i < RATE_STEPS.length; i++) {
    if (Math.abs(RATE_STEPS[i] - current) < Math.abs(RATE_STEPS[nearest] - current)) nearest = i;
  }

  return RATE_STEPS[(nearest + 1) % RATE_STEPS.length];
}
