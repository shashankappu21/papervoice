import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/ThemeProvider';
import { useImport } from '../../src/import/ImportProvider';
import { TabIcon } from '../../src/ui/TabIcon';
import { MiniPlayer } from '../../src/ui/MiniPlayer';
import { useTourTarget } from '../../src/tour/useTourTarget';

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

/** The bar itself, before the space Android wants underneath it. */
const BAR_HEIGHT = 62;
const BAR_PADDING = 8;

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
  /*
   * Replacing the default tab bar means replacing the inset handling that came
   * with it. Android reserves space at the bottom for its own navigation --
   * around 48dp of buttons, or about 24dp for the gesture pill -- and without
   * allowing for it the tabs sit underneath, which is what the gesture bar was
   * drawing straight through.
   */
  const insets = useSafeAreaInsets();

  const voicesTab = useTourTarget('voicesTab');

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
        {/*
          The tour measures this rather than the tab itself. A tab is a flex
          cell a third of the screen wide and the full height of the bar, so a
          spotlight on it is a band across the bottom of the screen pointing at
          nothing in particular. The icon and its label are the thing meant.
        */}
        <View
          ref={name === 'voices' ? voicesTab.ref : undefined}
          onLayout={name === 'voices' ? voicesTab.onLayout : undefined}
          style={styles.tabMark}
        >
          <TabIcon focused={focused} color={tint} name={icon} />
          <Animated.Text style={[styles.label, { color: tint }]}>{label}</Animated.Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ backgroundColor: colors.bg }}>
      <MiniPlayer />
      <View
        style={[
          styles.bar,
          {
            borderTopColor: colors.divider,
            height: BAR_HEIGHT + insets.bottom,
            paddingBottom: BAR_PADDING + insets.bottom,
          },
        ]}
      >
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
  const target = useTourTarget('import');
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
          /*
           * The tour measures the circle rather than the Pressable around it.
           * The circle is lifted clear of the bar with a negative margin, so
           * it is drawn outside its parent's layout box -- measuring the
           * parent put the spotlight below the button it was pointing at.
           */
          ref={target.ref}
          onLayout={target.onLayout}
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
  // Height and bottom padding are set inline: both grow by whatever Android
  // reserves for its own navigation.
  bar: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 6 },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabMark: { alignItems: 'center', justifyContent: 'center' },
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
