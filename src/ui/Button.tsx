import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from './ThemeProvider';
import { TAP_TARGET } from './theme';

type Variant = 'primary' | 'secondary' | 'ghost';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/**
 * The app's button, replacing React Native's own.
 *
 * The platform button cannot be styled, which is why the app had eleven of
 * them in three sizes and no way to guarantee a 44pt target. Pressing changes
 * colour rather than scale: a control that shrinks under the finger moves the
 * thing being pressed.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  accessibilityLabel,
}: Props) {
  const { colors, radius, space, font } = useTheme();

  const fill =
    variant === 'primary'
      ? colors.accent
      : variant === 'secondary'
        ? colors.surface
        : 'transparent';
  const label = variant === 'primary' ? colors.accentOn : colors.accent;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: fill,
          borderRadius: radius.sm,
          paddingHorizontal: space.lg,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: colors.border,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[styles.label, { color: label, fontSize: font.md }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: TAP_TARGET, alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: '600' },
});
