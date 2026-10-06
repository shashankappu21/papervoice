import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFontSize, useTheme, useThemeSetting } from '../src/ui/ThemeProvider';
import { FONT_SIZE_RANGE, type ThemeSetting } from '../src/ui/theme';
import { OFFERED_VOICES } from '../src/voices/catalog';
import { useTour } from '../src/tour/TourProvider';
import { getSetting, setSetting as saveSetting, SETTING_THREADS } from '../src/db/settings';
import { DEFAULT_THREADS, THREAD_CHOICES, parseThreads } from '../src/voices/threads';

/** Taps on the title that open the developer section. */
const DEVELOPER_TAPS = 7;

const THEME_CHOICES: Array<{ value: ThemeSetting; label: string; icon: 'phone-portrait' | 'sunny' | 'book' | 'moon' }> = [
  { value: 'system', label: 'System', icon: 'phone-portrait' },
  { value: 'light', label: 'Light', icon: 'sunny' },
  { value: 'paper', label: 'Paper', icon: 'book' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

export default function Settings() {
  const router = useRouter();
  const { colors, space, font, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { setting, setSetting } = useThemeSetting();
  const { fontSize, setFontSize } = useFontSize();
  const { replay } = useTour();
  const [replayed, setReplayed] = useState(false);

  /*
   * A developer section, reached by tapping the title. Hidden rather than
   * removed from release builds, because the battery measurements it serves
   * only mean anything on a release build -- a debug build runs a different JS
   * engine path and a bundler connection, and drains differently.
   */
  const taps = useRef(0);
  const [developer, setDeveloper] = useState(false);
  const [threads, setThreads] = useState(DEFAULT_THREADS);

  useEffect(() => {
    if (!developer) return;
    getSetting(SETTING_THREADS).then((stored) => setThreads(parseThreads(stored)), () => undefined);
  }, [developer]);

  const chooseThreads = (value: number) => {
    setThreads(value);
    void saveSetting(SETTING_THREADS, String(value));
  };

  // Attribution is a licence condition of the CC BY voices, not a courtesy.
  const licences = [...new Set(OFFERED_VOICES.map((voice) => voice.licence))].sort();

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{
        padding: space.xl,
        paddingTop: insets.top + space.sm,
        paddingBottom: space.xxxl,
      }}
    >
      <View style={styles.head}>
        {/* No role and no pressed state: this is not meant to look tappable. */}
        <Pressable
          onPress={() => {
            taps.current += 1;
            if (taps.current >= DEVELOPER_TAPS) setDeveloper(true);
          }}
        >
          <Text style={[styles.heading, { color: colors.text, fontSize: font.display }]}>
            Settings
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close settings"
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons name="close" size={28} color={colors.text} />
        </Pressable>
      </View>

      <Text style={[styles.section, { color: colors.textMuted, fontSize: font.xs }]}>
        APPEARANCE
      </Text>
      <View style={[styles.themes, { gap: space.sm }]}>
        {THEME_CHOICES.map((choice) => {
          const on = setting === choice.value;
          return (
            <Pressable
              key={choice.value}
              onPress={() => setSetting(choice.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [
                styles.theme,
                {
                  backgroundColor: on ? colors.accent : colors.surface,
                  borderRadius: radius.md,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons
                name={choice.icon}
                size={22}
                color={on ? colors.accentOn : colors.textMuted}
              />
              <Text
                style={{
                  color: on ? colors.accentOn : colors.text,
                  fontSize: font.sm,
                  fontWeight: '600',
                  marginTop: 6,
                }}
              >
                {choice.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text
        style={[
          styles.section,
          { color: colors.textMuted, fontSize: font.xs, marginTop: space.xxl },
        ]}
      >
        TEXT SIZE
      </Text>
      <View
        style={[
          styles.sizeRow,
          { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md },
        ]}
      >
        <Pressable
          onPress={() => setFontSize(fontSize - FONT_SIZE_RANGE.step)}
          disabled={fontSize <= FONT_SIZE_RANGE.min}
          accessibilityRole="button"
          accessibilityLabel="Smaller text"
          hitSlop={8}
          style={{ opacity: fontSize <= FONT_SIZE_RANGE.min ? 0.3 : 1 }}
        >
          <Ionicons name="remove-circle-outline" size={30} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize, flex: 1, textAlign: 'center' }}>
          The quick brown fox
        </Text>
        <Pressable
          onPress={() => setFontSize(fontSize + FONT_SIZE_RANGE.step)}
          disabled={fontSize >= FONT_SIZE_RANGE.max}
          accessibilityRole="button"
          accessibilityLabel="Larger text"
          hitSlop={8}
          style={{ opacity: fontSize >= FONT_SIZE_RANGE.max ? 0.3 : 1 }}
        >
          <Ionicons name="add-circle-outline" size={30} color={colors.text} />
        </Pressable>
      </View>

      <Text
        style={[
          styles.section,
          { color: colors.textMuted, fontSize: font.xs, marginTop: space.xxl },
        ]}
      >
        HELP
      </Text>
      <Pressable
        onPress={() => {
          // Cleared rather than started here: the tours point at controls on
          // other screens, and one begun from Settings would spotlight things
          // that are not on display.
          void replay().then(() => setReplayed(true));
        }}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.note,
          {
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            padding: space.lg,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Ionicons name="help-circle" size={20} color={colors.accent} />
        <Text style={{ color: colors.text, fontSize: font.sm, lineHeight: 20, flex: 1 }}>
          {replayed
            ? 'Done — the tour starts again when you go back to the library.'
            : 'Show me around again'}
        </Text>
      </Pressable>

      <Text
        style={[
          styles.section,
          { color: colors.textMuted, fontSize: font.xs, marginTop: space.xxl },
        ]}
      >
        PRIVACY
      </Text>
      <View
        style={[
          styles.note,
          { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg },
        ]}
      >
        <Ionicons name="lock-closed" size={20} color={colors.accent} />
        <Text style={{ color: colors.text, fontSize: font.sm, lineHeight: 20, flex: 1 }}>
          Everything happens on this phone. Your documents are never uploaded, and voices that
          would speak over the internet are not offered at all.
        </Text>
      </View>

      <Text
        style={[
          styles.section,
          { color: colors.textMuted, fontSize: font.xs, marginTop: space.xxl },
        ]}
      >
        VOICE LICENCES
      </Text>
      {licences.map((licence) => (
        <Text
          key={licence}
          style={{ color: colors.textMuted, fontSize: font.sm, marginTop: space.xs }}
        >
          {licence}
        </Text>
      ))}

      {developer && (
        <>
          <Text
            style={[
              styles.section,
              { color: colors.textMuted, fontSize: font.xs, marginTop: space.xxl },
            ]}
          >
            DEVELOPER
          </Text>
          <Text style={{ color: colors.text, fontSize: font.sm, marginBottom: space.sm }}>
            Inference threads
          </Text>
          <View style={[styles.themes, { gap: space.sm }]}>
            {THREAD_CHOICES.map((value) => {
              const on = threads === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => chooseThreads(value)}
                  accessibilityRole="button"
                  accessibilityLabel={`${value} inference thread${value === 1 ? '' : 's'}`}
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [
                    styles.theme,
                    {
                      minHeight: 52,
                      backgroundColor: on ? colors.accent : colors.surface,
                      borderRadius: radius.md,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: on ? colors.accentOn : colors.text,
                      fontSize: font.md,
                      fontWeight: '700',
                    }}
                  >
                    {value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: font.xs,
              lineHeight: 17,
              marginTop: space.sm,
            }}
          >
            Read when a voice loads. Force-stop and reopen the app after changing it, and
            check the log says "loaded on {threads} inference thread(s)". Default {DEFAULT_THREADS}.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  heading: { fontWeight: '800', letterSpacing: -0.5 },
  section: { fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 },
  themes: { flexDirection: 'row' },
  theme: { flex: 1, minHeight: 72, alignItems: 'center', justifyContent: 'center' },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  note: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
});
