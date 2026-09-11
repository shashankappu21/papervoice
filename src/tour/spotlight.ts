export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Screen {
  width: number;
  height: number;
}

/**
 * The four pieces of dimming that surround a control, leaving it uncovered.
 *
 * A hole rather than a highlight drawn on top: the gap is real, so the control
 * underneath is still there to be pressed. That is the difference between a
 * tour that shows you the button and one that lets you press it, and it is why
 * this is four rectangles instead of one overlay with a bright ring on it.
 *
 * Order is top, bottom, left, right. The side pieces span only the target's own
 * height, because the top and bottom pieces already cover everything else.
 */
export function cutOut(target: Rect | null, screen: Screen, margin: number): Rect[] {
  if (!target) {
    // Nothing to point at: one piece covering everything, and three empty ones
    // so the caller always has four to draw.
    return [
      { x: 0, y: 0, width: screen.width, height: screen.height },
      { x: 0, y: screen.height, width: screen.width, height: 0 },
      { x: 0, y: 0, width: 0, height: 0 },
      { x: 0, y: 0, width: 0, height: 0 },
    ];
  }

  // Clamped, because a control against an edge leaves no room on that side and
  // a rectangle of negative width is not drawn as nothing -- it is drawn wrong.
  const left = Math.max(0, target.x - margin);
  const top = Math.max(0, target.y - margin);
  const right = Math.min(screen.width, target.x + target.width + margin);
  const bottom = Math.min(screen.height, target.y + target.height + margin);

  return [
    { x: 0, y: 0, width: screen.width, height: top },
    { x: 0, y: bottom, width: screen.width, height: Math.max(0, screen.height - bottom) },
    { x: 0, y: top, width: left, height: Math.max(0, bottom - top) },
    {
      x: right,
      y: top,
      width: Math.max(0, screen.width - right),
      height: Math.max(0, bottom - top),
    },
  ];
}

/** How much of the screen may sit below a target before the caption moves up. */
const ROOM_BELOW = 0.72;

/** Which side of the target the caption goes, so it is never off the screen. */
export function captionSide(target: Rect | null, screen: Screen): 'above' | 'below' | 'centre' {
  if (!target) return 'centre';
  // The tab bar is what this is for: a caption below it has nowhere to go.
  return target.y + target.height > screen.height * ROOM_BELOW ? 'above' : 'below';
}
