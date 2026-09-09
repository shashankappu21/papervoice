import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/ui/Button';
import { useFontSize, useTheme, useThemeSetting } from '../src/ui/ThemeProvider';
import { FONT_SIZE_RANGE, type ThemeSetting } from '../src/ui/theme';
import { OFFERED_VOICES } from '../src/voices/catalog';

const THEME_CHOICES: Array<{ value: ThemeSetting; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'paper', label: 'Paper' },
  { value: 'dark', label: 'Dark' },
];

export default function Settings() {
  const { colors, space, font } = useTheme();
  const { setting, setSetting } = useThemeSetting();
  const { fontSize, setFontSize } = useFontSize();

  // Attribution is a licence condition of the CC BY voices, not a courtesy.
  const licences = [...new Set(OFFERED_VOICES.map((voice) => voice.licence))].sort();

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl }}
    >
      <Text style={[styles.section, { color: colors.textMuted, fontSize: font.xs }]}>THEME</Text>
      <View style={styles.row}>
        {THEME_CHOICES.map((choice) => (
          <Button
            key={choice.value}
            title={choice.label}
            variant={setting === choice.value ? 'primary' : 'secondary'}
            onPress={() => setSetting(choice.value)}
          />
        ))}
      </View>

      <Text
        style={[
          styles.section,
          { color: colors.textMuted, fontSize: font.xs, marginTop: space.xxl },
        ]}
      >
        TEXT SIZE
      </Text>
      <View style={styles.row}>
        <Button
          title="Smaller"
          variant="secondary"
          disabled={fontSize <= FONT_SIZE_RANGE.min}
          onPress={() => setFontSize(fontSize - FONT_SIZE_RANGE.step)}
        />
        <Text style={{ color: colors.text, fontSize, alignSelf: 'center' }}>{fontSize}pt</Text>
        <Button
          title="Larger"
          variant="secondary"
          disabled={fontSize >= FONT_SIZE_RANGE.max}
          onPress={() => setFontSize(fontSize + FONT_SIZE_RANGE.step)}
        />
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
      <Text
        style={{
          color: colors.textMuted,
          fontSize: font.sm,
          marginTop: space.md,
          lineHeight: 19,
        }}
      >
        Voices are downloaded from their publishers and stay on this phone. Nothing you read is
        ever sent anywhere.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
