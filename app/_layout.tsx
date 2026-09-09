import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync } from 'expo-audio';
import { ThemeProvider, useTheme } from '../src/ui/ThemeProvider';

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
      <Chrome />
    </ThemeProvider>
  );
}

/** Separate from the provider so that it sits inside it and can read the theme. */
function Chrome() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.divider },
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Library',
          tabBarIcon: ({ color, size }) => <Ionicons name="book" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="voices"
        options={{
          title: 'Voices',
          tabBarIcon: ({ color, size }) => <Ionicons name="mic" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
        }}
      />
      {/* Reading takes the whole screen: no tab bar under a page of prose. */}
      <Tabs.Screen name="reader/[bookId]" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}
