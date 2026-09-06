import { useCallback, useState } from 'react';
import { ActivityIndicator, Button, FlatList, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { VOICES, type VoiceMeta } from '../src/voices/catalog';
import { voiceStore } from '../src/voices/deviceVoices';
import { getSetting, setSetting, SETTING_VOICE } from '../src/db/settings';

const megabytes = (bytes: number) => `${Math.round(bytes / 1_000_000)} MB`;

/**
 * The voices that can be installed.
 *
 * Nothing here is bundled: the app reads with the system voice from the moment
 * it installs, and a natural voice is a deliberate download made once.
 */
export default function Voices() {
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ id: string; fraction: number } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const store = voiceStore();
    setInstalled(new Set(VOICES.filter((voice) => store.isInstalled(voice)).map((v) => v.id)));
    getSetting(SETTING_VOICE).then(setSelected, () => undefined);
  }, []);

  useFocusEffect(refresh);

  const install = async (voice: VoiceMeta) => {
    setFailed(null);
    setProgress({ id: voice.id, fraction: 0 });
    try {
      await voiceStore().install(voice, (fraction) => setProgress({ id: voice.id, fraction }));
      await setSetting(SETTING_VOICE, voice.id);
    } catch (cause) {
      setFailed(String(cause));
    } finally {
      setProgress(null);
      refresh();
    }
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Voices' }} />

      <Text style={styles.note}>
        A voice is downloaded once and then works with no connection at all. It is why your
        books never leave your phone.
      </Text>

      <FlatList
        data={VOICES}
        keyExtractor={(voice) => voice.id}
        renderItem={({ item }) => {
          const isInstalled = installed.has(item.id);
          const busy = progress?.id === item.id;
          return (
            <View style={styles.voice}>
              <View style={styles.headline}>
                <Text style={styles.name}>{item.name}</Text>
                {selected === item.id && <Text style={styles.badge}>in use</Text>}
              </View>
              <Text style={styles.detail}>
                {item.accent} · {item.gender} · {megabytes(item.sizeBytes)} · {item.licence}
              </Text>

              {busy ? (
                <View style={styles.progressRow}>
                  <ActivityIndicator size="small" />
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.round(progress.fraction * 100)}%` }]} />
                  </View>
                  <Text style={styles.detail}>{Math.round(progress.fraction * 100)}%</Text>
                </View>
              ) : (
                <View style={styles.actions}>
                  {isInstalled ? (
                    <>
                      <Button
                        title={selected === item.id ? 'In use' : 'Use this voice'}
                        disabled={selected === item.id}
                        onPress={() => void setSetting(SETTING_VOICE, item.id).then(refresh)}
                      />
                      <Button
                        title="Remove"
                        onPress={() => {
                          voiceStore().remove(item);
                          refresh();
                        }}
                      />
                    </>
                  ) : (
                    <Button
                      title={`Download ${megabytes(item.sizeBytes)}`}
                      disabled={progress !== null}
                      onPress={() => void install(item)}
                    />
                  )}
                </View>
              )}
            </View>
          );
        }}
      />

      {failed && <Text style={styles.failed}>{failed}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  note: { padding: 16, fontSize: 13, color: '#666', lineHeight: 19 },
  voice: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#eee', gap: 6 },
  headline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 17, fontWeight: '600' },
  badge: { fontSize: 11, color: '#2f95dc', borderWidth: 1, borderColor: '#2f95dc', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  detail: { fontSize: 12, color: '#777' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  track: { flex: 1, height: 4, backgroundColor: '#e4e4e4', borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: '#2f95dc' },
  failed: { padding: 16, color: '#b00020', fontSize: 13 },
});
