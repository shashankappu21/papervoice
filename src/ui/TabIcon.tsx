import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, type ColorValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Name = React.ComponentProps<typeof Ionicons>['name'];

/**
 * A tab icon that acknowledges being chosen.
 *
 * Swapping an outline for a filled glyph is a single frame -- correct, and
 * lifeless. The icon lifts and settles instead, which is the difference between
 * a tab bar that responds and one that merely updates.
 */
export function TabIcon({
  focused,
  color,
  name,
}: {
  focused: boolean;
  /** Wider than a string: React Navigation hands the tint through as given. */
  color: ColorValue;
  /** The outline glyph. The filled one is assumed to be the same name without it. */
  name: Name;
}) {
  const lift = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(lift, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start();
  }, [focused, lift]);

  const filled = name.replace(/-outline$/, '') as Name;

  return (
    <Animated.View
      style={[
        styles.icon,
        {
          transform: [
            { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
            { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) },
          ],
        },
      ]}
    >
      <Ionicons name={focused ? filled : name} size={24} color={color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  icon: { alignItems: 'center', justifyContent: 'center' },
});
