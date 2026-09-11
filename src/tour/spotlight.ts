export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * One piece of dimming, positioned by the edges it touches rather than by size.
 *
 * Anchors instead of width and height on purpose. The first version worked out
 * each piece from the window's reported dimensions, and those are not measured
 * in the same space as the controls: with edge-to-edge layout a window reports
 * a height that leaves out the system bars, while measureInWindow includes
 * them. The bottom piece therefore stopped short and left the tab bar lit.
 *
 * Anchored to `bottom: 0` and `right: 0`, a piece reaches the real edge of
 * whatever it is drawn in, and the only numbers involved are the target's own.
 */
export interface Panel {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  width?: number;
  height?: number;
}

/**
 * The four pieces of dimming that surround a control, leaving it uncovered.
 *
 * A hole rather than a highlight drawn on top: the gap is real, so the control
 * underneath is still there to be pressed. That is the difference between a
 * tour that shows you the button and one that lets you press it.
 *
 * Order is top, bottom, left, right. The side pieces span only the target's own
 * height, because the top and bottom pieces already cover everything else.
 */
export function cutOut(target: Rect | null, margin: number): Panel[] {
  if (!target) {
    // Nothing to point at: one piece covering everything, and three empty ones
    // so the caller always has four to draw.
    return [{ top: 0, bottom: 0, left: 0, right: 0 }, {}, {}, {}];
  }

  // Clamped at zero: a control against an edge leaves no room on that side,
  // and a piece of negative width is not drawn as nothing, it is drawn wrong.
  const top = Math.max(0, target.y - margin);
  const bottom = target.y + target.height + margin;
  const left = Math.max(0, target.x - margin);
  const right = target.x + target.width + margin;
  const height = Math.max(0, bottom - top);

  return [
    { top: 0, left: 0, right: 0, height: top },
    { top: bottom, left: 0, right: 0, bottom: 0 },
    { top, left: 0, width: left, height },
    { top, left: right, right: 0, height },
  ];
}

/** How far down the screen a target may sit before its caption moves above it. */
const ROOM_BELOW = 0.62;

/**
 * Which side of the target the caption goes, so it is never off the screen.
 *
 * `height` is the overlay's own measured height rather than the window's,
 * for the same reason the panels are anchored: it is the only number known to
 * be in the same space as the target.
 */
export function captionSide(
  target: Rect | null,
  height: number,
): 'above' | 'below' | 'centre' {
  if (!target) return 'centre';
  if (height <= 0) return 'below';
  // The tab bar is what this is for: a caption below it has nowhere to go.
  return target.y + target.height > height * ROOM_BELOW ? 'above' : 'below';
}
