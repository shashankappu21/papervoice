import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { setAudioModeAsync } from 'expo-audio';
import { ThemeProvider, useTheme } from '../src/ui/ThemeProvider';
import { ImportProvider } from '../src/import/ImportProvider';
import { PlaybackProvider } from '../src/player/PlaybackProvider';
import { TourProvider } from '../src/tour/TourProvider';
import { TourOverlay } from '../src/tour/TourOverlay';
import { migrateAudioCache } from '../src/tts/cacheMigration';

export default function RootLayout() {
  useEffect(() => {
    // Reading a book has to survive the screen locking, and it should stop
    // other audio rather than talk over it.
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });

    // Clears audio the old per-speed cache layout left behind. Once per install;
    // a failure is retried on the next launch, and none of it blocks reading.
    migrateAudioCache().catch((cause: unknown) => {
      console.log('[papervoice] cache migration failed:', String(cause));
    });
  }, []);

  return (
    <ThemeProvider>
      {/*
        Playback sits above the screens, so walking from the reader back to the
        library does not tear the engine down mid-sentence -- and so the bar
        above the tabs has something to show.
      */}
      <PlaybackProvider>
        <ImportProvider>
          {/* Above the routes, so the tour can point at anything on any of them. */}
          <TourProvider>
            <Routes />
            <TourOverlay />
          </TourProvider>
        </ImportProvider>
      </PlaybackProvider>
    </ThemeProvider>
  );
}

function Routes() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" />
      {/*
        The reader rises over the tabs rather than replacing them, which is how
        a player behaves everywhere else and is the reason it can be dismissed
        downwards.
      */}
      <Stack.Screen
        name="reader/[bookId]"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="settings"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
    </Stack>
  );
}
