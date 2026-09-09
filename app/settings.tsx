import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFontSize, useTheme, useThemeSetting } from '../src/ui/ThemeProvider';
import { FONT_SIZE_RANGE, type ThemeSetting } from '../src/ui/theme';
import { OFFERED_VOICES } from '../src/voices/catalog';

const THEME_CHOICES: Array<{ value: ThemeSetting; label: string; icon: 'phone-portrait' | 'sunny' | 'book' | 'moon' }> = [
  { value: 'system', label: 'System', icon: 'phone-portrait' },
  { value: 'light', label: 'Light', icon: 'sunny' },
  { value: 'paper', label: 'Paper', icon: 'book' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

export default function Settings() {
  const { colors, space, font, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { setting, setSetting } = useThemeSetting();
  const { fontSize, setFontSize } = useFontSize();

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
      <Text style={[styles.heading, { color: colors.text, fontSize: font.display }]}>
        Settings
      </Text>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  heading: { fontWeight: '800', letterSpacing: -0.5, marginBottom: 24 },
  section: { fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 },
  themes: { flexDirection: 'row' },
  theme: { flex: 1, minHeight: 72, alignItems: 'center', justifyContent: 'center' },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  note: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
});
