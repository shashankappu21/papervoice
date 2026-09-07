import { useCallback, useState } from 'react';
import { ActivityIndicator, Button, FlatList, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { VOICES, type VoiceMeta } from '../src/voices/catalog';
import { voiceStore, removeUnknownVoices } from '../src/voices/deviceVoices';
import { listUsableSystemVoices, systemVoiceId, systemVoiceLabel } from '../src/voices/engine';
import type { SystemVoice } from '../modules/system-tts';
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
  const [system, setSystem] = useState<SystemVoice[]>([]);
  const [hiddenVoices, setHiddenVoices] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ id: string; fraction: number } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const refresh = useCallback(() => {
    // A voice withdrawn from the catalog has no button left to remove it, so
    // its files are cleaned up here rather than kept for ever.
    try {
      removeUnknownVoices();
    } catch {
      // Reclaiming space is worth doing, not worth failing the screen over.
    }
    const store = voiceStore();
    setInstalled(new Set(VOICES.filter((voice) => store.isInstalled(voice)).map((v) => v.id)));
    getSetting(SETTING_VOICE).then(setSelected, () => undefined);
    listUsableSystemVoices().then(
      ({ usable, hiddenForNetwork }) => {
        setSystem(usable);
        setHiddenVoices(hiddenForNetwork);
      },
      () => setSystem([]),
    );
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
        ListHeaderComponent={
          <View>
            <Text style={styles.section}>Already on this phone</Text>
            {system.length === 0 && (
              <Text style={styles.detail}>
                No offline system voice was found. Voices that speak over the network are not
                offered, because reading one of your documents with them would send it away.
              </Text>
            )}
            {system.slice(0, 4).map((voice) => {
              const id = systemVoiceId(voice);
              return (
                <View key={id} style={styles.voice}>
                  <View style={styles.headline}>
                    <Text style={styles.name}>{systemVoiceLabel(voice)}</Text>
                    {selected === id && <Text style={styles.badge}>in use</Text>}
                  </View>
                  <Text style={styles.detail}>
                    System voice · works offline · nothing to download
                  </Text>
                  <View style={styles.actions}>
                    <Button
                      title={selected === id ? 'In use' : 'Use this voice'}
                      disabled={selected === id}
                      onPress={() => void setSetting(SETTING_VOICE, id).then(refresh)}
                    />
                  </View>
                </View>
              );
            })}
            {hiddenVoices > 0 && (
              <Text style={styles.hidden}>
                {hiddenVoices} more {hiddenVoices === 1 ? 'voice is' : 'voices are'} installed on
                this phone but {hiddenVoices === 1 ? 'speaks' : 'speak'} over the internet. Reading
                a document with {hiddenVoices === 1 ? 'it' : 'them'} would send it away, so
                {hiddenVoices === 1 ? ' it is' : ' they are'} not offered.
              </Text>
            )}
            <Text style={styles.section}>Natural voices</Text>
          </View>
        }
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
  hidden: { paddingHorizontal: 20, paddingTop: 10, fontSize: 12, color: '#999', lineHeight: 17 },
  section: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6, fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
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
