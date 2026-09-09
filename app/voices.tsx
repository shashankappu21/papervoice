import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { OFFERED_VOICES, type VoiceMeta } from '../src/voices/catalog';
import { voiceStore, removeUnknownVoices } from '../src/voices/deviceVoices';
import { listUsableSystemVoices, systemVoiceId, systemVoiceLabel } from '../src/voices/engine';
import type { SystemVoice } from '../modules/system-tts';
import { getSetting, setSetting, SETTING_VOICE } from '../src/db/settings';
import { Button } from '../src/ui/Button';
import { useTheme } from '../src/ui/ThemeProvider';

const megabytes = (bytes: number) => `${Math.round(bytes / 1_000_000)} MB`;

type Accent = 'all' | 'US' | 'GB';
type Gender = 'all' | 'female' | 'male';

/**
 * The voices that can be installed.
 *
 * Nothing here is bundled: the app reads with the system voice from the moment
 * it installs, and a natural voice is a deliberate download made once.
 */
export default function Voices() {
  const { colors, space, font, radius } = useTheme();
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [system, setSystem] = useState<SystemVoice[]>([]);
  const [hiddenVoices, setHiddenVoices] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ id: string; fraction: number } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [accent, setAccent] = useState<Accent>('all');
  const [gender, setGender] = useState<Gender>('all');

  const refresh = useCallback(() => {
    // A voice withdrawn from the catalog has no button left to remove it, so
    // its files are cleaned up here rather than kept for ever.
    try {
      removeUnknownVoices();
    } catch {
      // Reclaiming space is worth doing, not worth failing the screen over.
    }
    const store = voiceStore();
    setInstalled(
      new Set(OFFERED_VOICES.filter((voice) => store.isInstalled(voice)).map((v) => v.id)),
    );
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

  const shown = OFFERED_VOICES.filter(
    (voice) =>
      (accent === 'all' || voice.accent === accent) &&
      (gender === 'all' || voice.gender === gender),
  );

  // Installed first: a voice that is ready to use is more interesting than one
  // that is a 63MB download away.
  const ordered = [
    ...shown.filter((voice) => installed.has(voice.id)),
    ...shown.filter((voice) => !installed.has(voice.id)),
  ];

  const section = (text: string, extra?: object) => (
    <Text
      style={[styles.section, { color: colors.textMuted, fontSize: font.xs, ...(extra ?? {}) }]}
    >
      {text}
    </Text>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <FlatList
        data={ordered}
        keyExtractor={(voice) => voice.id}
        ListHeaderComponent={
          <View>
            <Text
              style={{
                padding: space.lg,
                color: colors.textMuted,
                fontSize: font.sm,
                lineHeight: 19,
              }}
            >
              A voice is downloaded once and then works with no connection at all. It is why your
              books never leave your phone.
            </Text>

            {section('ALREADY ON THIS PHONE')}
            {system.length === 0 && (
              <Text
                style={{
                  paddingHorizontal: space.xl,
                  color: colors.textMuted,
                  fontSize: font.xs,
                }}
              >
                No offline system voice was found. Voices that speak over the network are not
                offered, because reading one of your documents with them would send it away.
              </Text>
            )}
            {system.slice(0, 4).map((voice) => {
              const id = systemVoiceId(voice);
              return (
                <View
                  key={id}
                  style={[styles.voice, { borderTopColor: colors.divider, padding: space.xl }]}
                >
                  <View style={styles.headline}>
                    <Text style={{ color: colors.text, fontSize: font.lg, fontWeight: '600' }}>
                      {systemVoiceLabel(voice)}
                    </Text>
                    {selected === id && (
                      <Text
                        style={[
                          styles.badge,
                          { color: colors.accent, borderColor: colors.accent, borderRadius: radius.sm },
                        ]}
                      >
                        in use
                      </Text>
                    )}
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: font.xs, marginVertical: 6 }}>
                    System voice · works offline · nothing to download
                  </Text>
                  <View style={styles.actions}>
                    <Button
                      title={selected === id ? 'In use' : 'Use this voice'}
                      variant="secondary"
                      disabled={selected === id}
                      onPress={() => void setSetting(SETTING_VOICE, id).then(refresh)}
                    />
                  </View>
                </View>
              );
            })}
            {hiddenVoices > 0 && (
              <Text
                style={{
                  paddingHorizontal: space.xl,
                  paddingTop: space.sm,
                  color: colors.textMuted,
                  fontSize: font.xs,
                  lineHeight: 17,
                }}
              >
                {hiddenVoices} more {hiddenVoices === 1 ? 'voice is' : 'voices are'} installed on
                this phone but {hiddenVoices === 1 ? 'speaks' : 'speak'} over the internet. Reading
                a document with {hiddenVoices === 1 ? 'it' : 'them'} would send it away, so
                {hiddenVoices === 1 ? ' it is' : ' they are'} not offered.
              </Text>
            )}

            {section('NATURAL VOICES', { marginTop: 16 })}
            <View style={[styles.filters, { paddingHorizontal: space.xl, gap: space.sm }]}>
              {(['all', 'US', 'GB'] as Accent[]).map((option) => (
                <Button
                  key={option}
                  title={option === 'all' ? 'Any accent' : option}
                  variant={accent === option ? 'primary' : 'secondary'}
                  onPress={() => setAccent(option)}
                />
              ))}
            </View>
            <View
              style={[
                styles.filters,
                { paddingHorizontal: space.xl, gap: space.sm, paddingTop: space.sm },
              ]}
            >
              {(['all', 'female', 'male'] as Gender[]).map((option) => (
                <Button
                  key={option}
                  title={option === 'all' ? 'Any voice' : option}
                  variant={gender === option ? 'primary' : 'secondary'}
                  onPress={() => setGender(option)}
                />
              ))}
            </View>
            {ordered.length === 0 && (
              <Text
                style={{
                  padding: space.xl,
                  color: colors.textMuted,
                  fontSize: font.md,
                }}
              >
                No voice matches those filters.
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const isInstalled = installed.has(item.id);
          const busy = progress?.id === item.id;
          return (
            <View style={[styles.voice, { borderTopColor: colors.divider, padding: space.xl }]}>
              <View style={styles.headline}>
                <Text style={{ color: colors.text, fontSize: font.lg, fontWeight: '600' }}>
                  {item.name}
                </Text>
                {selected === item.id && (
                  <Text
                    style={[
                      styles.badge,
                      { color: colors.accent, borderColor: colors.accent, borderRadius: radius.sm },
                    ]}
                  >
                    in use
                  </Text>
                )}
              </View>
              <Text style={{ color: colors.textMuted, fontSize: font.xs, marginVertical: 6 }}>
                {item.accent} · {item.gender} · {megabytes(item.sizeBytes)} · {item.licence}
              </Text>

              {busy ? (
                <View style={styles.progressRow}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <View style={[styles.track, { backgroundColor: colors.divider }]}>
                    <View
                      style={[
                        styles.fill,
                        {
                          width: `${Math.round(progress.fraction * 100)}%`,
                          backgroundColor: colors.accent,
                        },
                      ]}
                    />
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: font.xs }}>
                    {Math.round(progress.fraction * 100)}%
                  </Text>
                </View>
              ) : (
                <View style={styles.actions}>
                  {isInstalled ? (
                    <>
                      <Button
                        title={selected === item.id ? 'In use' : 'Use this voice'}
                        variant="secondary"
                        disabled={selected === item.id}
                        onPress={() => void setSetting(SETTING_VOICE, item.id).then(refresh)}
                      />
                      <Button
                        title="Remove"
                        variant="ghost"
                        accessibilityLabel={`Remove ${item.name}`}
                        onPress={() => {
                          voiceStore().remove(item);
                          refresh();
                        }}
                      />
                    </>
                  ) : (
                    <Button
                      title={`Download ${megabytes(item.sizeBytes)}`}
                      accessibilityLabel={`Download ${item.name}, ${megabytes(item.sizeBytes)}`}
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

      {failed && (
        <Text style={{ padding: 16, color: colors.danger, fontSize: font.sm }}>{failed}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  section: { paddingHorizontal: 20, paddingBottom: 6, fontWeight: '700', letterSpacing: 0.5 },
  voice: { borderTopWidth: 1, gap: 2 },
  headline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { fontSize: 11, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 1 },
  filters: { flexDirection: 'row', flexWrap: 'wrap' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 2, flexWrap: 'wrap' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  track: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
});
