import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';

/** How long the controls stay once reading starts. */
const HIDE_AFTER_MS = 3000;

/** How long a tap brings them back for. */
const REVEAL_FOR_MS = 4000;

const FADE_MS = 250;

/**
 * Hides the controls while the voice is reading, and brings them back on a tap.
 *
 * A page being read aloud does not need buttons on it, and the text is the
 * point. Nothing hides while paused: a stopped reader is looking at the
 * controls, not through them.
 */
export function useAutoHide(active: boolean) {
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useRef(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      reduceMotion.current = on;
    });
  }, []);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const fade = useCallback(
    (to: number) => {
      setVisible(to === 1);
      // Someone who has asked for less motion gets the change without it,
      // rather than not getting the change.
      if (reduceMotion.current) {
        opacity.setValue(to);
        return;
      }
      Animated.timing(opacity, { toValue: to, duration: FADE_MS, useNativeDriver: true }).start();
    },
    [opacity],
  );

  const hideLater = useCallback(
    (delay: number) => {
      clear();
      timer.current = setTimeout(() => fade(0), delay);
    },
    [clear, fade],
  );

  useEffect(() => {
    if (!active) {
      clear();
      fade(1);
      return;
    }
    hideLater(HIDE_AFTER_MS);
    // Every timer is cleared on the way out as well as on change, so leaving
    // the reader mid-sentence cannot fire a callback into a screen that has
    // gone.
    return clear;
  }, [active, clear, fade, hideLater]);

  const reveal = useCallback(() => {
    fade(1);
    if (active) hideLater(REVEAL_FOR_MS);
  }, [active, fade, hideLater]);

  return { visible, opacity, reveal };
}
