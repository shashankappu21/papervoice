import { useCallback, useEffect, useRef } from 'react';
import type { View } from 'react-native';
import { useTour } from './TourProvider';
import type { TargetId } from './steps';

/**
 * Marks a control as something a tour can point at.
 *
 * Returns a ref to put on the view and an onLayout to pass through. Both are
 * needed: onLayout says when the control has moved, and the ref is what can
 * then be measured in screen coordinates -- onLayout alone reports a position
 * inside the parent, which is not where the overlay is drawn.
 */
export function useTourTarget(id: TargetId) {
  const { register } = useTour();
  const ref = useRef<View>(null);

  const measure = useCallback(() => {
    // A frame's delay: measuring during layout returns the position before it
    // settled, which puts the spotlight slightly off every time.
    requestAnimationFrame(() => {
      ref.current?.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) register(id, { x, y, width, height });
      });
    });
  }, [id, register]);

  // A control that leaves the screen must stop being a target, or the tour
  // points at where it used to be.
  useEffect(() => () => register(id, null), [id, register]);

  return { ref, onLayout: measure };
}
