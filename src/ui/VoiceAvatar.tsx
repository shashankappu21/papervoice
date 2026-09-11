import { StyleSheet, View } from 'react-native';
import { useTheme } from './ThemeProvider';

/**
 * A voice, as a little waveform of its own.
 *
 * It was an initial in a circle, which made seventeen voices look like
 * seventeen letters -- and told a reader nothing about what they were choosing
 * between. A waveform at least says "sound", and giving each voice its own bar
 * heights makes them tell each other apart at a glance, which is what an
 * avatar is for.
 *
 * Speechify puts a photographed face on every voice. Ours are open models with
 * no faces to use and no right to invent one.
 */

/** Mid-tone enough that white bars sit on any of them. */
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

/** How many bars the waveform has. Enough to differ, few enough to read small. */
const BARS = 5;

/**
 * The same name always gives the same picture, on every phone and every run.
 *
 * A hash rather than an index, so adding or reordering voices in the catalog
 * does not silently reassign every avatar.
 */
function seedOf(name: string): number {
  let seed = 0;
  for (let i = 0; i < name.length; i++) seed = (seed * 31 + name.charCodeAt(i)) % 100_000;
  return seed;
}

function shapeOf(name: string): { colour: string; heights: number[] } {
  const seed = seedOf(name);
  const heights: number[] = [];

  for (let bar = 0; bar < BARS; bar++) {
    // Each bar takes a different slice of the seed, so the bars within one
    // avatar vary rather than all following the name's length.
    const slice = Math.floor(seed / 7 ** bar) % 100;
    // Never below a third: a bar that nearly vanishes reads as a rendering
    // fault rather than as a quiet moment.
    heights.push(0.34 + (slice / 100) * 0.66);
  }

  return { colour: HUES[seed % HUES.length], heights };
}

export function VoiceAvatar({ name, size = 44 }: { name: string; size?: number }) {
  const { colors } = useTheme();
  const { colour, heights } = shapeOf(name);

  const barWidth = Math.max(2, size * 0.08);
  const gap = Math.max(1, size * 0.045);

  return (
    <View
      // Decorative: the name is already beside it, and a screen reader
      // announcing a waveform adds nothing.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colour,
          borderColor: colors.bg,
          gap,
        },
      ]}
    >
      {heights.map((height, bar) => (
        <View
          key={bar}
          style={{
            width: barWidth,
            height: size * 0.52 * height,
            borderRadius: barWidth / 2,
            backgroundColor: '#ffffff',
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
});
