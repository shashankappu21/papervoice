import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from './ThemeProvider';
import { TAP_TARGET } from './theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  name: IconName;
  /**
   * Required, not optional. An icon alone says nothing to a screen reader, and
   * making the label part of the type is the only way to be sure one exists.
   */
  label: string;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  /** Overrides the default, for a control that should read as the main one. */
  color?: string;
}

export function IconButton({
  name,
  label,
  onPress,
  disabled = false,
  size = 24,
  color,
}: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        { opacity: disabled ? 0.35 : pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons name={name} size={size} color={color ?? colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: TAP_TARGET,
    minHeight: TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
