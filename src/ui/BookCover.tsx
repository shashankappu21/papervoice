import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from './ThemeProvider';

/**
 * A book, before we have its real cover.
 *
 * Rendering page one of the PDF is the right answer and is coming; until then
 * a plain grey rectangle would make the library look broken rather than
 * unfinished. So the placeholder is derived from the title -- a colour and its
 * first letters -- which gives each book something to recognise it by, and
 * looks deliberate rather than absent.
 */

const SPINES = [
  ['#4f46e5', '#7c3aed'],
  ['#0e7490', '#0f766e'],
  ['#b45309', '#c2410c'],
  ['#be185d', '#9d174d'],
  ['#1d4ed8', '#0891b2'],
  ['#4d7c0f', '#15803d'],
];

function spineFor(title: string): string[] {
  let total = 0;
  for (let i = 0; i < title.length; i++) total = (total + title.charCodeAt(i) * (i + 3)) % 4096;
  return SPINES[total % SPINES.length];
}

export function BookCover({
  title,
  width,
  height,
}: {
  title: string;
  width: number;
  height: number;
}) {
  const { radius, colors } = useTheme();
  const [top] = spineFor(title);

  // Up to two initials: "Never Split the Difference" reads better as NS than N,
  // and small words are skipped so it is not "NT".
  const initials = title
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.cover,
        {
          width,
          height,
          borderRadius: radius.md,
          backgroundColor: top,
          borderColor: colors.divider,
        },
      ]}
    >
      <Text
        style={{
          color: '#ffffff',
          fontSize: Math.max(12, width * 0.3),
          fontWeight: '800',
          letterSpacing: 0.5,
        }}
      >
        {initials || '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1 },
});
