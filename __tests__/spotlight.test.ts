import { describe, expect, it } from 'vitest';
import { cutOut, captionSide, type Rect } from '../src/tour/spotlight';

const SCREEN = { width: 400, height: 800 };
const target: Rect = { x: 100, y: 300, width: 200, height: 60 };

describe('cutOut', () => {
  it('covers the screen except the target', () => {
    const [top, bottom, left, right] = cutOut(target, SCREEN, 0);

    expect(top).toEqual({ x: 0, y: 0, width: 400, height: 300 });
    expect(bottom).toEqual({ x: 0, y: 360, width: 400, height: 440 });
    expect(left).toEqual({ x: 0, y: 300, width: 100, height: 60 });
    expect(right).toEqual({ x: 300, y: 300, width: 100, height: 60 });
  });

  it('leaves a margin around the target so it is not crowded', () => {
    const [top, , left] = cutOut(target, SCREEN, 8);
    expect(top.height).toBe(292);
    expect(left.width).toBe(92);
  });

  it('never gives a piece a negative size', () => {
    // A control against an edge -- the tab bar, a corner button -- leaves no
    // room on that side, and a rectangle of negative width is drawn as a
    // rectangle of some other size entirely.
    const edge: Rect = { x: 0, y: 0, width: 400, height: 60 };
    for (const piece of cutOut(edge, SCREEN, 12)) {
      expect(piece.width).toBeGreaterThanOrEqual(0);
      expect(piece.height).toBeGreaterThanOrEqual(0);
    }
  });

  it('dims everything when there is nothing to point at', () => {
    // A step with no target is a plain message, and the screen behind it
    // should be evenly dark rather than holed.
    const [top, bottom, left, right] = cutOut(null, SCREEN, 8);
    expect(top).toEqual({ x: 0, y: 0, width: 400, height: 800 });
    expect(bottom.height).toBe(0);
    expect(left.width).toBe(0);
    expect(right.width).toBe(0);
  });
});

describe('captionSide', () => {
  it('puts the caption below a target near the top', () => {
    expect(captionSide({ x: 0, y: 40, width: 100, height: 50 }, SCREEN)).toBe('below');
  });

  it('puts the caption above a target near the bottom', () => {
    // The tab bar is the case this exists for: a caption below it would be
    // off the screen.
    expect(captionSide({ x: 0, y: 720, width: 400, height: 60 }, SCREEN)).toBe('above');
  });

  it('puts the caption below a target in the middle', () => {
    expect(captionSide({ x: 0, y: 380, width: 100, height: 50 }, SCREEN)).toBe('below');
  });

  it('centres it when there is nothing to point at', () => {
    expect(captionSide(null, SCREEN)).toBe('centre');
  });
});
