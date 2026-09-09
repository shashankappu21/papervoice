import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from './ThemeProvider';

/**
 * A book's picture.
 *
 * Page one, drawn during extraction. For a book that is the jacket, for a scan
 * it is the scan, and for a bare text PDF it is the title page -- all three are
 * the right picture, so none of them needs a special case.
 *
 * Books imported before covers existed have none, and a grey rectangle would
 * make the library look broken rather than old. Those fall back to a colour and
 * initials taken from the title, which at least looks deliberate.
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
  uri,
}: {
  title: string;
  width: number;
  height: number;
  /** Page one, when it was drawn at import. */
  uri?: string | null;
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

  if (uri) {
    return (
      <Image
        source={{ uri }}
        accessibilityIgnoresInvertColors
        style={[
          styles.cover,
          { width, height, borderRadius: radius.md, borderColor: colors.divider },
        ]}
        // The page is a portrait of unknown proportions; cover fills the frame
        // and crops rather than leaving bars down the sides.
        resizeMode="cover"
      />
    );
  }

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
