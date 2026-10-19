import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './ThemeProvider';
import { LIMITS, voicesPayload } from '../feedback/payload';
import { answerVoiceReport, dismissVoiceReport, listenedByVoice } from '../feedback/asks';
import { appInfo, SURVEY_PREVIEW } from '../feedback/send';
import { PRIVACY_URL } from '../feedback/privacy';
import { topVoices, voicesTried } from '../stats/listening';
import { labelledSystemVoices, listUsableSystemVoices, systemVoiceId } from '../voices/engine';
import { voiceDisplayName } from '../voices/listing';

/**
 * Which voices someone stays with, once, after an hour of listening.
 *
 * The voices that get listened to longest are the ones to recommend, and
 * nobody can tell that from what they first picked. So this shows exactly
 * what it would send -- the voices, the minutes, how many were tried -- with
 * room to say which voice they would recommend, and sends it only on Send.
 * "No thanks", tapping outside and Back are final, as with the questionnaire.
 */
/** A preview build with nothing counted yet shows these, so the sheet can be looked at. */
const PREVIEW_TOTALS: Record<string, number> = {
  'system:en-us-x-iob-local': 2040,
  'ljspeech-medium': 720,
  'system:en-au-x-aub-local': 540,
};

export function VoiceReportSheet({ onDone }: { onDone: () => void }) {
  const { colors, space, radius, font } = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(true);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [comment, setComment] = useState('');
  const [thanked, setThanked] = useState(false);
  const scroller = useRef<ScrollView>(null);

  useEffect(() => {
    void listenedByVoice().then((counted) =>
      setTotals(SURVEY_PREVIEW && Object.keys(counted).length === 0 ? PREVIEW_TOTALS : counted),
    );
    listUsableSystemVoices()
      .then(({ usable }) =>
        setNames(new Map(labelledSystemVoices(usable).map(({ voice, label }) => [systemVoiceId(voice), label]))),
      )
      .catch(() => undefined);
  }, []);

  // The comment is the only field: once the keyboard is up, keep it and Send in view.
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => scroller.current?.scrollToEnd());
    return () => shown.remove();
  }, []);

  const close = (after = 0) => {
    setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 350);
    }, after);
  };

  const noThanks = () => {
    void dismissVoiceReport();
    close();
  };

  const top = topVoices(totals, 3);
  const tried = voicesTried(totals);
  const minutes = (seconds: number) => `${Math.max(1, Math.round(seconds / 60))} min`;

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
        <Pressable
          style={[styles.backdrop, { paddingTop: insets.top + space.lg }]}
          onPress={thanked ? undefined : noThanks}
        >
          <Pressable
            onPress={() => undefined}
            style={{
              backgroundColor: colors.bg,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingTop: space.md,
              paddingHorizontal: space.xl,
              paddingBottom: insets.bottom + space.lg,
              flexShrink: 1,
            }}
          >
            <View style={[styles.grip, { backgroundColor: colors.divider }]} />

            <ScrollView
              ref={scroller}
              style={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {thanked ? (
                <View style={[styles.thanks, { paddingVertical: space.xxxl }]}>
                  <Ionicons name="checkmark-circle" size={48} color={colors.accent} />
                  <Text style={{ color: colors.text, fontSize: font.xl, fontWeight: '700', marginTop: space.md }}>
                    Thank you!
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: font.sm, marginTop: space.xs }}>
                    It helps us recommend the right voices.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={{ color: colors.text, fontSize: font.xl, fontWeight: '700' }}>
                    You&apos;ve listened for an hour
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: font.sm, marginTop: 2, marginBottom: space.lg }}>
                    Help us recommend better voices.
                  </Text>

                  {top.length > 0 && (
                    <View style={[styles.voices, { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md }]}>
                      <Text style={[styles.question, { color: colors.text, fontSize: font.md }]}>Your voices</Text>
                      {top.map(({ id, seconds }) => (
                        <View key={id} style={styles.voiceRow}>
                          <Text style={{ flex: 1, color: colors.text, fontSize: font.md }}>
                            {voiceDisplayName(id, names)}
                          </Text>
                          <Text style={{ color: colors.textMuted, fontSize: font.md }}>{minutes(seconds)}</Text>
                        </View>
                      ))}
                      <Text style={{ color: colors.textMuted, fontSize: font.sm, marginTop: space.sm }}>
                        {tried === 1 ? 'You have listened with one voice.' : `You have tried ${tried} voices.`}
                      </Text>
                    </View>
                  )}

                  <TextInput
                    value={comment}
                    onChangeText={setComment}
                    maxLength={LIMITS.comment}
                    multiline
                    placeholder="Which voices would you recommend? Anything about the voices? (optional)"
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
                    onPress={() => {
                      void answerVoiceReport(voicesPayload({ totals, comment }, appInfo()));
                      setThanked(true);
                      close(1800);
                    }}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.send,
                      {
                        marginTop: space.lg,
                        backgroundColor: colors.accent,
                        borderRadius: radius.pill,
                        opacity: pressed ? 0.75 : 1,
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

                  <Text style={{ color: colors.textMuted, fontSize: font.xs, textAlign: 'center' }}>
                    Only which voices you used and for how long. ·{' '}
                    <Text
                      onPress={() => void Linking.openURL(PRIVACY_URL)}
                      accessibilityRole="link"
                      style={{ color: colors.accent, fontWeight: '600' }}
                    >
                      Privacy
                    </Text>
                  </Text>
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { flexGrow: 0 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  grip: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  thanks: { alignItems: 'center' },
  question: { fontWeight: '600', marginBottom: 8 },
  voices: {},
  voiceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  send: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  noThanks: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
