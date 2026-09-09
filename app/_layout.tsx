import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync } from 'expo-audio';
import { ThemeProvider, useTheme } from '../src/ui/ThemeProvider';
import { ImportProvider, useImport } from '../src/import/ImportProvider';
import { TabIcon } from '../src/ui/TabIcon';

export default function RootLayout() {
  useEffect(() => {
    // Reading a book has to survive the screen locking, and it should stop
    // other audio rather than talk over it.
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
  }, []);

  return (
    <ThemeProvider>
      <ImportProvider>
        <Chrome />
      </ImportProvider>
    </ThemeProvider>
  );
}

/** Separate from the providers so that it sits inside them and can read both. */
function Chrome() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        // Each screen sets its own large title, so a second small one in a
        // navigation bar would be the same word twice.
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.divider,
          height: 64,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
        // The reader slides up over the tabs, the way a player does.
        animation: 'shift',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Library',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} name="library-outline" />
          ),
        }}
      />

      {/*
        Adding a document is the app's primary action, so it sits in the middle
        rather than in a corner. Three tabs, not four: with an even number the
        centre falls between two of them and the button is off to one side.
      */}
      <Tabs.Screen
        name="import"
        options={{
          title: '',
          tabBarButton: (props) => <ImportButton accessibilityState={props.accessibilityState} />,
        }}
      />

      <Tabs.Screen
        name="voices"
        options={{
          title: 'Voices',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} name="mic-outline" />
          ),
        }}
      />

      {/* Reachable from the gear on the other screens, not from the bar. */}
      <Tabs.Screen name="settings" options={{ href: null }} />

      {/* Reading takes the whole screen: no tab bar under a page of prose. */}
      <Tabs.Screen
        name="reader/[bookId]"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
    </Tabs>
  );
}

/**
 * The centre button, which opens a file picker rather than a screen.
 *
 * It is raised above the bar because it does something rather than going
 * somewhere, and that difference should be visible before it is pressed.
 */
function ImportButton({ accessibilityState }: { accessibilityState?: { selected?: boolean } }) {
  const { colors } = useTheme();
  const { start, busy } = useImport();
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 8 }).start();

  return (
    <View style={styles.slot}>
      <Pressable
        onPress={start}
        onPressIn={() => spring(0.9)}
        onPressOut={() => spring(1)}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Import a PDF"
        accessibilityState={{ ...accessibilityState, disabled: busy }}
      >
        <Animated.View
          style={[
            styles.button,
            {
              backgroundColor: colors.accent,
              transform: [{ scale }],
              opacity: busy ? 0.5 : 1,
              borderColor: colors.bg,
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
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    // Lifted clear of the bar so it reads as an action, not a destination.
    marginTop: -18,
    borderWidth: 4,
  },
});
