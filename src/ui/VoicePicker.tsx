import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from './ThemeProvider';
import { VoiceAvatar } from './VoiceAvatar';
import { useSample } from './useSample';
import { useReading } from '../player/PlaybackProvider';
import { OFFERED_VOICES } from '../voices/catalog';
import { voiceStore } from '../voices/deviceVoices';
import { labelledSystemVoices, listUsableSystemVoices, systemVoiceId } from '../voices/engine';
import { mainList, pickerSections, regionLabel, voiceDisplayName, type ListedVoice } from '../voices/listing';
import type { LabelledPhoneVoice } from '../voices/order';
import { profileText, suggestVoices } from '../voices/suggest';
import type { SystemVoice } from '../../modules/system-tts';
import type { Sentence } from '../extraction/types';

interface Props {
  visible: boolean;
  chosenId: string | null;
  /** The book's text, for suggesting a voice that suits it. */
  sentences: Sentence[];
  onClose(): void;
  onChoose(id: string): void;
  /** A voice finished downloading: the player's own list needs it too. */
  onInstalled(): void;
}

/** Enough of a book to tell what kind it is, without reading all of it. */
const PROFILE_CHARS = 80_000;

const megabytes = (bytes: number) => `${Math.round(bytes / 1_000_000)} MB`;

/**
 * Choosing a voice while listening, as a sheet that rises from the bottom.
 *
 * This is the moment people want a different voice, so it does more than list
 * what is already on the phone: a voice suggested for this book, the voice
 * reading now, the best of the rest to try -- each with a sample, and the
 * natural ones downloadable right here while the book keeps playing -- and a
 * way to everything else in the Voices tab.
 *
 * It slides rather than appears. A panel that is simply there has to be read to
 * be understood; one that arrives from the edge it is anchored to has already
 * explained itself by the time it stops.
 */
export function VoicePicker({ visible, chosenId, sentences, onClose, onChoose, onInstalled }: Props) {
  const { colors, space, radius, font } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const slide = useRef(new Animated.Value(0)).current;
  const sample = useSample();
  const stopSample = sample.stop;
  const reading = useReading();
  const [phone, setPhone] = useState<Array<LabelledPhoneVoice<SystemVoice>>>([]);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ id: string; fraction: number } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    Animated.spring(slide, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 2,
    }).start();
  }, [visible, slide]);

  const refresh = useCallback(() => {
    const store = voiceStore();
    setInstalled(new Set(OFFERED_VOICES.filter((voice) => store.isInstalled(voice)).map((voice) => voice.id)));
    listUsableSystemVoices().then(
      ({ usable }) => setPhone(labelledSystemVoices(usable)),
      () => setPhone([]),
    );
  }, []);

  // Fresh each time it opens -- a voice may have been downloaded meanwhile --
  // and a sample does not go on playing once it is closed.
  useEffect(() => {
    if (visible) refresh();
    else stopSample();
  }, [visible, refresh, stopSample]);

  const list = useMemo(() => mainList(OFFERED_VOICES, phone, systemVoiceId), [phone]);
  const listedIds = useMemo(() => new Set(list.map((voice) => voice.id)), [list]);

  const profile = useMemo(() => {
    let text = '';
    for (const sentence of sentences) {
      if (text.length > PROFILE_CHARS) break;
      text += ` ${sentence.text}`;
    }
    return profileText(text);
  }, [sentences]);
  const suggestion = useMemo(() => suggestVoices(profile, (id) => listedIds.has(id)), [profile, listedIds]);

  const sections = pickerSections(list, {
    chosenId,
    suggested: suggestion?.voiceIds ?? [],
    installed,
  });

  const phoneLabels = useMemo(
    () => new Map(phone.map(({ voice, label }) => [systemVoiceId(voice), label])),
    [phone],
  );
  const current = chosenId ? list.find((voice) => voice.id === chosenId) : undefined;
  const currentName = chosenId ? (current?.name ?? voiceDisplayName(chosenId, phoneLabels)) : null;

  /** A sample over the top of the book is two voices at once. */
  const hear = (id: string) => {
    if (reading.playback.playing) reading.playback.pause();
    sample.play(id);
  };

  const take = async (voice: ListedVoice) => {
    const natural = voice.natural;
    if (!natural || installed.has(voice.id)) {
      onChoose(voice.id);
      return;
    }
    // Downloads here, while the book goes on in the voice it has; when it is
    // in, it is the one chosen -- that was the point of tapping it.
    setFailed(null);
    setProgress({ id: voice.id, fraction: 0 });
    try {
      await voiceStore().install(natural, (fraction) => setProgress({ id: voice.id, fraction }));
      refresh();
      onInstalled();
      onChoose(voice.id);
    } catch (cause) {
      setFailed(String(cause));
    } finally {
      setProgress(null);
    }
  };

  const section = (title: string) => (
    <Text
      style={[
        styles.section,
        { color: colors.textMuted, fontSize: font.xs, paddingHorizontal: space.xl, marginTop: space.lg },
      ]}
    >
      {title}
    </Text>
  );

  const row = (voice: ListedVoice) => {
    const natural = voice.natural;
    const isInstalled = !natural || installed.has(voice.id);
    const busy = progress?.id === voice.id;
    const detail = `${regionLabel(voice.region)} · ${voice.gender}${
      natural ? (isInstalled ? '' : ` · ${megabytes(natural.sizeBytes)}`) : ' · on this phone'
    }`;
    return (
      <Pressable
        key={voice.id}
        accessibilityRole="button"
        accessibilityLabel={isInstalled ? `Read with ${voice.name}` : `Download ${voice.name} and read with it`}
        disabled={progress !== null}
        onPress={() => void take(voice)}
        style={({ pressed }) => [
          styles.row,
          {
            paddingHorizontal: space.xl,
            paddingVertical: space.sm,
            backgroundColor: pressed ? colors.surface : 'transparent',
          },
        ]}
      >
        <VoiceAvatar name={voice.name} size={44} />
        <View style={styles.rowText}>
          <Text style={{ color: colors.text, fontSize: font.lg, fontWeight: '600' }}>{voice.name}</Text>
          {voice.description && (
            <Text style={{ color: colors.text, fontSize: font.sm, marginTop: 1 }}>{voice.description}</Text>
          )}
          <Text style={{ color: colors.textMuted, fontSize: font.sm, marginTop: 1 }}>{detail}</Text>
          {busy && (
            <View style={[styles.track, { backgroundColor: colors.divider }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.round(progress.fraction * 100)}%`, backgroundColor: colors.accent },
                ]}
              />
            </View>
          )}
        </View>
        <Pressable
          onPress={() => hear(voice.id)}
          accessibilityRole="button"
          accessibilityLabel={sample.playing === voice.id ? `Stop the sample of ${voice.name}` : `Hear ${voice.name}`}
          hitSlop={10}
          style={({ pressed }) => [
            styles.sample,
            { borderColor: colors.border, borderRadius: radius.pill, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          {sample.downloading === voice.id ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons
              name={sample.playing === voice.id ? 'stop' : 'play'}
              size={16}
              color={colors.accent}
              style={sample.playing === voice.id ? undefined : { marginLeft: 2 }}
            />
          )}
        </Pressable>
        {busy ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : isInstalled ? null : (
          <Ionicons name="arrow-down-circle-outline" size={26} color={colors.accent} />
        )}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[
            styles.lift,
            {
              transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }],
            },
          ]}
        >
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.bg,
                borderTopLeftRadius: radius.xl,
                borderTopRightRadius: radius.xl,
                paddingTop: space.md,
              },
            ]}
            onPress={() => undefined}
          >
            <View style={[styles.grip, { backgroundColor: colors.divider }]} />

            <Text style={[styles.title, { color: colors.text, fontSize: font.xl, paddingHorizontal: space.xl }]}>
              Read with
            </Text>

            <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: insets.bottom + space.lg }}>
              {currentName && (
                <View style={[styles.row, { paddingHorizontal: space.xl, paddingVertical: space.sm }]}>
                  <VoiceAvatar name={currentName} size={44} />
                  <View style={styles.rowText}>
                    <Text style={{ color: colors.text, fontSize: font.lg, fontWeight: '700' }}>{currentName}</Text>
                    {current?.description && (
                      <Text style={{ color: colors.text, fontSize: font.sm, marginTop: 1 }}>{current.description}</Text>
                    )}
                    <Text style={{ color: colors.textMuted, fontSize: font.sm, marginTop: 1 }}>Reading now</Text>
                  </View>
                  {/* A tick as well as weight, because colour alone is
                      invisible to a reader who cannot distinguish it. */}
                  <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
                </View>
              )}

              {sections.suggested.length > 0 && suggestion && (
                <>
                  {section('SUGGESTED FOR THIS BOOK')}
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontSize: font.sm,
                      paddingHorizontal: space.xl,
                      marginBottom: space.xs,
                    }}
                  >
                    {suggestion.reason}.
                  </Text>
                  {sections.suggested.map(row)}
                </>
              )}

              {sections.tryThese.length > 0 && (
                <>
                  {section('TRY THESE')}
                  {sections.tryThese.map(row)}
                </>
              )}

              {sections.yours.length > 0 && (
                <>
                  {section('YOUR OTHER VOICES')}
                  {sections.yours.map(row)}
                </>
              )}

              {failed && (
                <Text style={{ color: colors.danger, fontSize: font.sm, paddingHorizontal: space.xl, marginTop: space.md }}>
                  {failed}
                </Text>
              )}

              <Pressable
                onPress={() => {
                  onClose();
                  router.push('/(tabs)/voices');
                }}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.all,
                  { paddingHorizontal: space.xl, paddingVertical: space.md, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={{ color: colors.accent, fontSize: font.md, fontWeight: '600' }}>All voices</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.accent} />
              </Pressable>
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  /*
   * The height limit lives here, on a view whose parent fills the screen, not
   * on the sheet itself. A percentage resolves against a parent with a definite
   * height; the sheet's parent had none, so the limit was measured against
   * nothing and the sheet stopped short of the bottom edge -- leaving the
   * player visible through the gap.
   */
  lift: { maxHeight: '85%' },
  sheet: { flexShrink: 1 },
  list: { flexShrink: 1 },
  grip: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  title: { fontWeight: '700', paddingBottom: 4 },
  section: { fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1 },
  sample: { width: 34, height: 34, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  fill: { height: 4 },
  all: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
});
