import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from './ThemeProvider';

/**
 * A voice, as a circle with its initial in it.
 *
 * Speechify puts a photographed face on every voice. Ours are open models with
 * no faces to use and no right to invent one, so the avatar is a monogram
 * whose colour is derived from the name -- which still gives each voice
 * something recognisable to aim at in a list of seventeen.
 */

/** Enough hues to stay distinguishable, all mid-tone so white sits on any of them. */
const HUES = [
  '#4f46e5',
  '#0e7490',
  '#b45309',
  '#7c3aed',
  '#0f766e',
  '#be185d',
  '#4d7c0f',
  '#c2410c',
];

/** Same name, same colour, every time and on every phone. */
function hueFor(name: string): string {
  let total = 0;
  for (let i = 0; i < name.length; i++) total = (total + name.charCodeAt(i) * (i + 1)) % 4096;
  return HUES[total % HUES.length];
}

export function VoiceAvatar({ name, size = 44 }: { name: string; size?: number }) {
  const { colors } = useTheme();
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <View
      // Decorative: the name is already beside it, and a screen reader
      // announcing "letter L" adds nothing.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: hueFor(name),
          borderColor: colors.bg,
        },
      ]}
    >
      <Text style={{ color: '#ffffff', fontSize: size * 0.42, fontWeight: '700' }}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
});
