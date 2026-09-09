import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * A ring that turns while something is being waited for.
 *
 * Three of the four borders are transparent, so what is drawn is an arc rather
 * than a circle, and the arc going round is what reads as waiting. It runs on
 * the native driver: a spinner that stutters while the phone is busy says the
 * opposite of what it is there to say, and the phone is always busy when this
 * is on screen.
 */
export function Spinner({
  size,
  color,
  width = 3,
}: {
  size: number;
  color: string;
  width?: number;
}) {
  const turn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    turn.setValue(0);
    const loop = Animated.loop(
      Animated.timing(turn, {
        toValue: 1,
        duration: 900,
        // Linear, because a spinner that eases is a spinner that limps.
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [turn]);

  return (
    <Animated.View
      // Decorative: the button beside it already announces that it is busy.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: width,
        borderColor: 'transparent',
        borderTopColor: color,
        transform: [
          { rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
        ],
      }}
    />
  );
}
