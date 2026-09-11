import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useTheme } from './ThemeProvider';

/**
 * The shape of a page, while the real one is being read from disk.
 *
 * A spinner in the middle of an empty screen says only that something is
 * happening. Lines where the lines will be say what is coming, and make the
 * arrival of the text feel like it filling in rather than replacing something
 * else.
 *
 * The line lengths are fixed rather than random: a skeleton that reshuffles on
 * every render draws attention to itself, which is the opposite of the job.
 */
const LINES = [0.92, 0.98, 0.86, 0.95, 0.72, 0.9, 0.96, 0.83, 0.94, 0.6];

export function PageSkeleton({ fontSize }: { fontSize: number }) {
  const { colors, space } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // Opacity only, so the whole thing runs on the native driver and keeps
  // breathing evenly while the document is being parsed off the main thread.
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.page, { padding: space.xl }]}
    >
      {LINES.map((share, line) => (
        <Animated.View
          key={line}
          style={{
            opacity,
            width: `${share * 100}%`,
            height: fontSize * 0.62,
            borderRadius: fontSize * 0.31,
            backgroundColor: colors.divider,
            // Matches the reading line height, so the text lands where the
            // placeholder was rather than jumping.
            marginBottom: fontSize * 0.98,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
});
