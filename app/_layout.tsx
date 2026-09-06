import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { setAudioModeAsync } from 'expo-audio';

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

  return <Stack />;
}
