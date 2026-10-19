import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
 *
 * A sheet over the library, like the sleep timer's, so it reads as a question
 * put to the listener rather than one more thing in the list. Tapping outside
 * it, or Back, is the same as "No thanks".
 */
export function SurveySheet({ onDone }: { onDone: () => void }) {
  const { colors, space, radius, font } = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(true);
  const [use, setUse] = useState<Use | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [comment, setComment] = useState('');
  const [thanked, setThanked] = useState(false);

  /** Slides the sheet away, then lets the library forget it. */
  const close = (after = 0) => {
    setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 350);
    }, after);
  };

  const noThanks = () => {
    void dismissSurvey();
    close();
  };

  const Chips = <K extends string>({
    options,
    chosen,
    onChoose,
  }: {
    options: Record<K, string>;
    chosen: K | null;
    onChoose: (key: K) => void;
  }) => (
    <View style={[styles.chips, { gap: space.sm }]}>
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
                backgroundColor: on ? colors.accent : colors.surface,
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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={noThanks}
    >
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={thanked ? undefined : noThanks}>
          <Pressable
            onPress={() => undefined}
            style={{
              backgroundColor: colors.bg,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingTop: space.md,
              paddingHorizontal: space.xl,
              paddingBottom: insets.bottom + space.lg,
            }}
          >
            <View style={[styles.grip, { backgroundColor: colors.divider }]} />

            {thanked ? (
              <View style={[styles.thanks, { paddingVertical: space.xxxl }]}>
                <Ionicons name="checkmark-circle" size={48} color={colors.accent} />
                <Text style={{ color: colors.text, fontSize: font.xl, fontWeight: '700', marginTop: space.md }}>
                  Thank you!
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: font.sm, marginTop: space.xs }}>
                  It really helps decide what comes next.
                </Text>
              </View>
            ) : (
              <>
                <Text style={{ color: colors.text, fontSize: font.xl, fontWeight: '700' }}>Help shape Papervoice</Text>
                <Text style={{ color: colors.textMuted, fontSize: font.sm, marginTop: 2, marginBottom: space.lg }}>
                  Two quick questions, about 30 seconds.
                </Text>

                <Text style={[styles.question, { color: colors.text, fontSize: font.md }]}>
                  What will you mostly listen to?
                </Text>
                <Chips options={USES} chosen={use} onChoose={setUse} />

                <Text style={[styles.question, { color: colors.text, fontSize: font.md, marginTop: space.lg }]}>
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
                    backgroundColor: colors.surface,
                    borderRadius: radius.md,
                    padding: space.md,
                    marginTop: space.lg,
                    minHeight: 72,
                    fontSize: font.sm,
                    textAlignVertical: 'top',
                  }}
                />

                <Pressable
                  disabled={!ready}
                  onPress={() => {
                    if (!use || !source) return;
                    void answerSurvey(surveyPayload({ use, source, comment }, appInfo()));
                    setThanked(true);
                    close(1800);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !ready }}
                  style={({ pressed }) => [
                    styles.send,
                    {
                      marginTop: space.lg,
                      backgroundColor: colors.accent,
                      borderRadius: radius.pill,
                      opacity: !ready ? 0.4 : pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Text style={{ color: colors.accentOn, fontSize: font.md, fontWeight: '700' }}>Send</Text>
                </Pressable>

                <Pressable
                  onPress={noThanks}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.noThanks, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={{ color: colors.textMuted, fontSize: font.md, fontWeight: '600' }}>No thanks</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  grip: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  thanks: { alignItems: 'center' },
  question: { fontWeight: '600', marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { minHeight: 38, paddingHorizontal: 14, justifyContent: 'center' },
  send: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  noThanks: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
