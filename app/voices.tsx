import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OFFERED_VOICES, type VoiceMeta } from '../src/voices/catalog';
import { voiceStore, removeUnknownVoices } from '../src/voices/deviceVoices';
import { listUsableSystemVoices, systemVoiceId, systemVoiceLabel } from '../src/voices/engine';
import type { SystemVoice } from '../modules/system-tts';
import { getSetting, setSetting, SETTING_VOICE } from '../src/db/settings';
import { useTheme } from '../src/ui/ThemeProvider';
import { VoiceAvatar } from '../src/ui/VoiceAvatar';

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
  const insets = useSafeAreaInsets();
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

  // Installed first: a voice ready to use is more interesting than one that is
  // a 63MB download away.
  const ordered = [
    ...shown.filter((voice) => installed.has(voice.id)),
    ...shown.filter((voice) => !installed.has(voice.id)),
  ];

  const installedCount = OFFERED_VOICES.filter((voice) => installed.has(voice.id));
  const usedBytes = installedCount.reduce((total, voice) => total + voice.sizeBytes, 0);

  const Chip = ({
    label,
    on,
    onPress,
  }: {
    label: string;
    on: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: on ? colors.accent : colors.surface,
          borderRadius: radius.pill,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: on ? colors.accentOn : colors.text,
          fontSize: font.sm,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <FlatList
        data={ordered}
        keyExtractor={(voice) => voice.id}
        contentContainerStyle={{ paddingBottom: space.xxxl }}
        ListHeaderComponent={
          <View>
            <View style={{ paddingHorizontal: space.xl, paddingTop: insets.top + space.sm }}>
              <Text style={[styles.heading, { color: colors.text, fontSize: font.display }]}>
                Voices
              </Text>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: font.md,
                  marginTop: 4,
                  lineHeight: 21,
                }}
              >
                On-device voices — no internet required. It is why your books never leave your
                phone.
              </Text>
            </View>

            {system.length > 0 && (
              <View style={{ paddingHorizontal: space.xl, marginTop: space.xl }}>
                <Text style={[styles.section, { color: colors.textMuted, fontSize: font.xs }]}>
                  ALREADY ON THIS PHONE
                </Text>
                {system.slice(0, 4).map((voice) => {
                  const id = systemVoiceId(voice);
                  const inUse = selected === id;
                  return (
                    <Pressable
                      key={id}
                      onPress={() => void setSetting(SETTING_VOICE, id).then(refresh)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: inUse }}
                      style={({ pressed }) => [
                        styles.card,
                        {
                          backgroundColor: colors.surface,
                          borderRadius: radius.lg,
                          padding: space.md,
                          marginBottom: space.sm,
                          opacity: pressed ? 0.8 : 1,
                          borderWidth: inUse ? 2 : 0,
                          borderColor: colors.accent,
                        },
                      ]}
                    >
                      <VoiceAvatar name={systemVoiceLabel(voice)} size={44} />
                      <View style={styles.cardText}>
                        <Text
                          style={{ color: colors.text, fontSize: font.lg, fontWeight: '600' }}
                        >
                          {systemVoiceLabel(voice)}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: font.sm, marginTop: 2 }}>
                          System voice · nothing to download
                        </Text>
                      </View>
                      {inUse && (
                        <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {hiddenVoices > 0 && (
              <Text
                style={{
                  paddingHorizontal: space.xl,
                  color: colors.textMuted,
                  fontSize: font.xs,
                  lineHeight: 17,
                }}
              >
                {hiddenVoices} more {hiddenVoices === 1 ? 'voice speaks' : 'voices speak'} over the
                internet. Reading a document with {hiddenVoices === 1 ? 'it' : 'them'} would send
                it away, so {hiddenVoices === 1 ? 'it is' : 'they are'} not offered.
              </Text>
            )}

            <View style={{ paddingHorizontal: space.xl, marginTop: space.xl }}>
              <Text style={[styles.section, { color: colors.textMuted, fontSize: font.xs }]}>
                NATURAL VOICES
              </Text>
              <View style={[styles.chips, { gap: space.sm }]}>
                <Chip label="All" on={accent === 'all' && gender === 'all'} onPress={() => {
                  setAccent('all');
                  setGender('all');
                }} />
                <Chip label="US" on={accent === 'US'} onPress={() => setAccent('US')} />
                <Chip label="UK" on={accent === 'GB'} onPress={() => setAccent('GB')} />
                <Chip
                  label="Female"
                  on={gender === 'female'}
                  onPress={() => setGender(gender === 'female' ? 'all' : 'female')}
                />
                <Chip
                  label="Male"
                  on={gender === 'male'}
                  onPress={() => setGender(gender === 'male' ? 'all' : 'male')}
                />
              </View>
            </View>

            {ordered.length === 0 && (
              <Text
                style={{ padding: space.xl, color: colors.textMuted, fontSize: font.md }}
              >
                No voice matches those filters.
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const isInstalled = installed.has(item.id);
          const inUse = selected === item.id;
          const busy = progress?.id === item.id;

          return (
            <View style={{ paddingHorizontal: space.xl }}>
              <Pressable
                onPress={() =>
                  isInstalled
                    ? void setSetting(SETTING_VOICE, item.id).then(refresh)
                    : void install(item)
                }
                disabled={progress !== null}
                accessibilityRole="button"
                accessibilityState={{ selected: inUse, disabled: progress !== null }}
                accessibilityLabel={
                  isInstalled
                    ? `${item.name}, ${item.accent} ${item.gender}${inUse ? ', in use' : ''}`
                    : `Download ${item.name}, ${megabytes(item.sizeBytes)}`
                }
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderRadius: radius.lg,
                    padding: space.md,
                    marginBottom: space.sm,
                    opacity: pressed ? 0.8 : 1,
                    borderWidth: inUse ? 2 : 0,
                    borderColor: colors.accent,
                  },
                ]}
              >
                <VoiceAvatar name={item.name} size={44} />
                <View style={styles.cardText}>
                  <Text style={{ color: colors.text, fontSize: font.lg, fontWeight: '600' }}>
                    {item.name}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: font.sm, marginTop: 2 }}>
                    {item.accent === 'GB' ? 'UK' : 'US'} · {item.gender}
                    {isInstalled ? '' : ` · ${megabytes(item.sizeBytes)}`}
                  </Text>

                  {busy && (
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
                  )}
                </View>

                {busy ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : inUse ? (
                  <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
                ) : isInstalled ? (
                  <Pressable
                    onPress={() => {
                      voiceStore().remove(item);
                      refresh();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${item.name}`}
                    hitSlop={12}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
                  </Pressable>
                ) : (
                  <Ionicons name="arrow-down-circle-outline" size={26} color={colors.accent} />
                )}
              </Pressable>
            </View>
          );
        }}
        ListFooterComponent={
          <Text
            style={{
              color: colors.textMuted,
              fontSize: font.sm,
              textAlign: 'center',
              paddingTop: space.md,
            }}
          >
            {installedCount.length} installed · {megabytes(usedBytes)} used offline
          </Text>
        }
      />

      {failed && (
        <Text style={{ padding: space.lg, color: colors.danger, fontSize: font.sm }}>
          {failed}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  heading: { fontWeight: '800', letterSpacing: -0.5 },
  section: { fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  chip: { minHeight: 36, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 68 },
  cardText: { flex: 1 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 8 },
  fill: { height: 4 },
});
