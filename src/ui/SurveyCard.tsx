import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from './ThemeProvider';
import { LIMITS, SOURCES, USES, surveyPayload, type Source, type Use } from '../feedback/payload';
import { answerSurvey, dismissSurvey } from '../feedback/asks';
import { appInfo } from '../feedback/send';

/**
 * Two questions and a comment, once, after some real listening.
 *
 * The answers decide what Papervoice becomes next -- whether it leans towards
 * books or towards study -- so they are worth asking for, and worth asking for
 * briefly. "No thanks" is final.
 */
export function SurveyCard({ onDone }: { onDone: () => void }) {
  const { colors, space, radius, font } = useTheme();
  const [use, setUse] = useState<Use | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [comment, setComment] = useState('');
  const [thanked, setThanked] = useState(false);

  if (thanked) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, marginHorizontal: space.xl, marginBottom: space.lg }]}>
        <Text style={{ color: colors.text, fontSize: font.lg, fontWeight: '700' }}>Thank you!</Text>
        <Text style={{ color: colors.textMuted, fontSize: font.sm, marginTop: space.xs }}>
          It really helps decide what comes next.
        </Text>
      </View>
    );
  }

  const Chips = <K extends string>({
    options,
    chosen,
    onChoose,
  }: {
    options: Record<K, string>;
    chosen: K | null;
    onChoose: (key: K) => void;
  }) => (
    <View style={[styles.chips, { gap: space.xs }]}>
      {(Object.keys(options) as K[]).map((key) => {
        const on = chosen === key;
        return (
          <Pressable
            key={key}
            onPress={() => onChoose(key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: on ? colors.accent : colors.bg,
                borderRadius: radius.pill,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Text style={{ color: on ? colors.accentOn : colors.text, fontSize: font.sm, fontWeight: '600' }}>
              {options[key]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const ready = use !== null && source !== null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, marginHorizontal: space.xl, marginBottom: space.lg },
      ]}
    >
      <Text style={{ color: colors.text, fontSize: font.lg, fontWeight: '700' }}>Help shape Papervoice</Text>
      <Text style={{ color: colors.textMuted, fontSize: font.sm, marginTop: 2, marginBottom: space.md }}>
        Two quick questions, about 30 seconds.
      </Text>

      <Text style={[styles.question, { color: colors.text, fontSize: font.md }]}>What will you mostly listen to?</Text>
      <Chips options={USES} chosen={use} onChoose={setUse} />

      <Text style={[styles.question, { color: colors.text, fontSize: font.md, marginTop: space.md }]}>
        How did you find Papervoice?
      </Text>
      <Chips options={SOURCES} chosen={source} onChoose={setSource} />

      <TextInput
        value={comment}
        onChangeText={setComment}
        maxLength={LIMITS.comment}
        multiline
        placeholder="Anything that would make you use it more? (optional)"
        placeholderTextColor={colors.textMuted}
        style={{
          color: colors.text,
          backgroundColor: colors.bg,
          borderRadius: radius.md,
          padding: space.md,
          marginTop: space.md,
          minHeight: 64,
          fontSize: font.sm,
          textAlignVertical: 'top',
        }}
      />

      <View style={[styles.buttons, { marginTop: space.md, gap: space.sm }]}>
        <Pressable
          onPress={() => {
            void dismissSurvey();
            onDone();
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={{ color: colors.textMuted, fontSize: font.md, fontWeight: '600' }}>No thanks</Text>
        </Pressable>
        <Pressable
          disabled={!ready}
          onPress={() => {
            if (!use || !source) return;
            void answerSurvey(surveyPayload({ use, source, comment }, appInfo()));
            setThanked(true);
            setTimeout(onDone, 2500);
          }}
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready }}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: colors.accent,
              borderRadius: radius.pill,
              opacity: !ready ? 0.4 : pressed ? 0.75 : 1,
            },
          ]}
        >
          <Text style={{ color: colors.accentOn, fontSize: font.md, fontWeight: '700' }}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {},
  question: { fontWeight: '600', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { minHeight: 34, paddingHorizontal: 12, justifyContent: 'center' },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  button: { minHeight: 40, paddingHorizontal: 18, justifyContent: 'center' },
});
