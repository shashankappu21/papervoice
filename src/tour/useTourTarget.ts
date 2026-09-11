import { useCallback, useEffect, useRef } from 'react';
import { useWindowDimensions, type View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const { register, tour, step } = useTour();
  const ref = useRef<View>(null);

  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const measure = useCallback(() => {
    // A frame's delay: measuring during layout returns the position before it
    // settled, which puts the spotlight slightly off every time.
    requestAnimationFrame(() => {
      ref.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) register(id, { x, y, width: w, height: h });
      });
    });
  }, [id, register]);

  /*
   * Measured again whenever the space around the app changes, and whenever the
   * tour moves on.
   *
   * onLayout is not enough on its own. It fires when a view's size or position
   * within its parent changes -- and switching Android from gestures to
   * buttons changes neither. What changes is the inset below the tab bar, so
   * the bar grows and every control in it moves up the screen while sitting
   * exactly where it was inside its own parent. Nothing fired, the stale
   * rectangle stayed, and the spotlight sat a navigation bar's height below
   * the button it was pointing at.
   */
  useEffect(() => {
    measure();
  }, [measure, insets.top, insets.bottom, insets.left, insets.right, width, height, tour, step]);

  // A control that leaves the screen must stop being a target, or the tour
  // points at where it used to be.
  useEffect(() => () => register(id, null), [id, register]);

  return { ref, onLayout: measure };
}
