import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/ui/ThemeProvider';
import { feedbackEmail, feedbackPayload, LIMITS } from '../src/feedback/payload';
import { appInfo, deviceName, FEEDBACK_ENDPOINT, send } from '../src/feedback/send';

/**
 * Telling us something, from Settings.
 *
 * Says exactly what goes with the message before it is sent. Nothing is
 * queued: feedback is written in the moment, and when it cannot be sent the
 * mail app is one tap away with the same words already in it.
 */
export default function Feedback() {
  const router = useRouter();
  const { colors, space, font, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const info = { ...appInfo(), device: deviceName() };
  const canSend = FEEDBACK_ENDPOINT !== '';

  const submit = async () => {
    const payload = feedbackPayload({ message, email }, info);
    if (!payload) return;
    setState('sending');
    try {
      await send(payload);
      setState('sent');
    } catch {
      setState('failed');
    }
  };

  const byEmail = () => void Linking.openURL(feedbackEmail(message, info));

  const field = {
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: font.md,
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: space.xl, paddingTop: insets.top + space.sm, paddingBottom: space.xxxl }}
    >
      <View style={styles.head}>
        <Text style={[styles.heading, { color: colors.text, fontSize: font.display }]}>Feedback</Text>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons name="close" size={28} color={colors.text} />
        </Pressable>
      </View>

      {state === 'sent' ? (
        <View style={{ marginTop: space.xl }}>
          <Text style={{ color: colors.text, fontSize: font.xl, fontWeight: '700' }}>Thank you.</Text>
          <Text style={{ color: colors.textMuted, fontSize: font.md, marginTop: space.sm, lineHeight: 22 }}>
            {email.trim() ? 'We read every message, and will reply to the address you gave.' : 'We read every message.'}
          </Text>
        </View>
      ) : (
        <>
          <Text style={{ color: colors.textMuted, fontSize: font.md, lineHeight: 22, marginTop: space.md }}>
            Something broken, something missing, something you like — all of it helps.
          </Text>

          <TextInput
            value={message}
            onChangeText={setMessage}
            maxLength={LIMITS.message}
            multiline
            autoFocus
            placeholder="Your message"
            placeholderTextColor={colors.textMuted}
            style={[field, { minHeight: 160, marginTop: space.lg, textAlignVertical: 'top' }]}
          />
          <TextInput
            value={email}
            onChangeText={setEmail}
            maxLength={LIMITS.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Your email (optional)"
            placeholderTextColor={colors.textMuted}
            style={[field, { marginTop: space.md }]}
          />

          <Text style={{ color: colors.textMuted, fontSize: font.xs, marginTop: space.sm, lineHeight: 16 }}>
            Add your email if you'd like a reply. Sends your message, app version, Android version
            and phone model ({info.device}). Nothing about your books.
          </Text>

          {state === 'failed' && (
            <Text style={{ color: colors.danger, fontSize: font.sm, marginTop: space.md }}>
              Couldn't send — check your connection, or email us instead.
            </Text>
          )}

          <View style={[styles.buttons, { marginTop: space.lg, gap: space.sm }]}>
            <Pressable
              onPress={byEmail}
              accessibilityRole="button"
              style={({ pressed }) => [styles.button, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={{ color: colors.accent, fontSize: font.md, fontWeight: '600' }}>Email us instead</Text>
            </Pressable>
            {canSend && (
              <Pressable
                onPress={() => void submit()}
                disabled={!message.trim() || state === 'sending'}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor: colors.accent,
                    borderRadius: radius.pill,
                    opacity: !message.trim() || state === 'sending' ? 0.4 : pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Text style={{ color: colors.accentOn, fontSize: font.md, fontWeight: '700' }}>
                  {state === 'sending' ? 'Sending…' : 'Send'}
                </Text>
              </Pressable>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontWeight: '800', letterSpacing: -0.5 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  button: { minHeight: 44, paddingHorizontal: 18, justifyContent: 'center' },
});
