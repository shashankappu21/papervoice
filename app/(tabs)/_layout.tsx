import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/ThemeProvider';
import { useImport } from '../../src/import/ImportProvider';
import { TabIcon } from '../../src/ui/TabIcon';
import { MiniPlayer } from '../../src/ui/MiniPlayer';

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      // The bar carries the mini player above it, so the two move together and
      // a book being read is never more than one tap away.
      tabBar={(props) => <Bar {...props} />}
      screenOptions={{
        // Each screen sets its own large title, so a second small one in a
        // navigation bar would be the same word twice.
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Library' }} />
      <Tabs.Screen name="import" options={{ title: '' }} />
      <Tabs.Screen name="voices" options={{ title: 'Voices' }} />
    </Tabs>
  );
}

/** Which glyph belongs to which route, and in what order they sit. */
const TABS: Array<{ name: string; label: string; icon: 'library-outline' | 'mic-outline' }> = [
  { name: 'index', label: 'Library', icon: 'library-outline' },
  { name: 'voices', label: 'Voices', icon: 'mic-outline' },
];

interface BarProps {
  state: { index: number; routes: Array<{ key: string; name: string }> };
  navigation: { navigate: (name: string) => void };
}

function Bar({ state, navigation }: BarProps) {
  const { colors } = useTheme();

  const cell = (name: string, label: string, icon: 'library-outline' | 'mic-outline') => {
    const route = state.routes.find((candidate) => candidate.name === name);
    const focused = route ? state.routes[state.index]?.name === name : false;
    const tint = focused ? colors.accent : colors.textMuted;

    return (
      <Pressable
        key={name}
        onPress={() => navigation.navigate(name)}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: focused }}
        style={styles.cell}
      >
        <TabIcon focused={focused} color={tint} name={icon} />
        <Animated.Text style={[styles.label, { color: tint }]}>{label}</Animated.Text>
      </Pressable>
    );
  };

  return (
    <View style={{ backgroundColor: colors.bg }}>
      <MiniPlayer />
      <View style={[styles.bar, { borderTopColor: colors.divider }]}>
        {cell(TABS[0].name, TABS[0].label, TABS[0].icon)}
        <ImportButton />
        {cell(TABS[1].name, TABS[1].label, TABS[1].icon)}
      </View>
    </View>
  );
}

/**
 * The centre button, which opens a file picker rather than a screen.
 *
 * It is raised above the bar because it does something rather than going
 * somewhere, and that difference should be visible before it is pressed.
 */
function ImportButton() {
  const { colors } = useTheme();
  const { start, busy } = useImport();
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 8 }).start();

  return (
    <View style={styles.cell}>
      <Pressable
        onPress={start}
        onPressIn={() => spring(0.9)}
        onPressOut={() => spring(1)}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Import a PDF"
        accessibilityState={{ disabled: busy }}
      >
        <Animated.View
          style={[
            styles.add,
            {
              backgroundColor: colors.accent,
              borderColor: colors.bg,
              transform: [{ scale }],
              opacity: busy ? 0.5 : 1,
            },
          ]}
        >
          <Ionicons name="add" size={30} color={colors.accentOn} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 1, height: 62, paddingTop: 6, paddingBottom: 8 },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  add: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    // Lifted clear of the bar so it reads as an action, not a destination.
    marginTop: -20,
    borderWidth: 4,
  },
});
