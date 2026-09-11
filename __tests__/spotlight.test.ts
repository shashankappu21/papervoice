import { describe, expect, it } from 'vitest';
import { cutOut, captionSide, type Rect } from '../src/tour/spotlight';

const target: Rect = { x: 100, y: 300, width: 200, height: 60 };

describe('cutOut', () => {
  it('surrounds the target without covering it', () => {
    const [top, bottom, left, right] = cutOut(target, 0);

    expect(top).toEqual({ top: 0, left: 0, right: 0, height: 300 });
    expect(bottom).toEqual({ top: 360, left: 0, right: 0, bottom: 0 });
    expect(left).toEqual({ top: 300, left: 0, width: 100, height: 60 });
    expect(right).toEqual({ top: 300, left: 300, right: 0, height: 60 });
  });

  it('reaches the real edges rather than a guessed size', () => {
    /*
     * The bug this replaced: panel sizes were worked out from the window's
     * reported height, which with edge-to-edge layout leaves out the system
     * bars, while the target is measured in a space that includes them. The
     * bottom panel stopped short and left the tab bar undimmed.
     */
    const [, bottom, , right] = cutOut(target, 0);
    expect(bottom.bottom).toBe(0);
    expect(right.right).toBe(0);
    expect(bottom.height).toBeUndefined();
  });

  it('leaves a margin around the target so it is not crowded', () => {
    const [top, bottom, left] = cutOut(target, 8);
    expect(top.height).toBe(292);
    expect(bottom.top).toBe(368);
    expect(left.width).toBe(92);
  });

  it('never gives a piece a negative size', () => {
    // A control against an edge -- a corner button -- leaves no room on that
    // side, and a rectangle of negative width is drawn as some other size.
    const corner: Rect = { x: 0, y: 0, width: 200, height: 60 };
    for (const piece of cutOut(corner, 12)) {
      if (piece.width !== undefined) expect(piece.width).toBeGreaterThanOrEqual(0);
      if (piece.height !== undefined) expect(piece.height).toBeGreaterThanOrEqual(0);
    }
  });

  it('dims everything when there is nothing to point at', () => {
    // A step with no target is a plain message, and the screen behind it
    // should be evenly dark rather than holed.
    const [all, ...rest] = cutOut(null, 8);
    expect(all).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
    expect(rest).toEqual([{}, {}, {}]);
  });
});

describe('captionSide', () => {
  it('puts the caption below a target near the top', () => {
    expect(captionSide({ x: 0, y: 40, width: 100, height: 50 }, 800)).toBe('below');
  });

  it('puts the caption above a target near the bottom', () => {
    // The tab bar is the case this exists for: a caption below it would be
    // off the screen.
    expect(captionSide({ x: 0, y: 720, width: 400, height: 60 }, 800)).toBe('above');
  });

  it('centres it when there is nothing to point at', () => {
    expect(captionSide(null, 800)).toBe('centre');
  });

  it('assumes below until the overlay has been measured', () => {
    // Height is zero on the first render. Guessing "above" then would anchor
    // the caption to a bottom that is not known yet.
    expect(captionSide({ x: 0, y: 720, width: 400, height: 60 }, 0)).toBe('below');
  });
});
