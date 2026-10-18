import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './ThemeProvider';
import { SLEEP_MINUTES, sleepLabel, type SleepTimer } from '../player/sleepTimer';

interface Props {
  visible: boolean;
  timer: SleepTimer | null;
  /** Offered only when the book has chapters to stop at. */
  hasChapters: boolean;
  onChoose(choice: { minutes: number } | 'chapter' | null): void;
  onClose(): void;
}

/**
 * When to stop reading tonight.
 *
 * A short list rather than a picker: these are the choices people make in
 * bed, half asleep, with one thumb.
 */
export function SleepSheet({ visible, timer, hasChapters, onChoose, onClose }: Props) {
  const { colors, space, radius, font } = useTheme();
  const insets = useSafeAreaInsets();

  const choices: Array<{ label: string; choice: { minutes: number } | 'chapter' | null; on: boolean }> = [
    { label: 'Off', choice: null, on: timer === null },
    ...SLEEP_MINUTES.map((minutes) => ({
      label: `${minutes} minutes`,
      choice: { minutes },
      // The one counting down is not marked: it no longer has that many
      // minutes left, and the header shows what it does have.
      on: false,
    })),
    ...(hasChapters
      ? [{ label: 'End of chapter', choice: 'chapter' as const, on: timer?.kind === 'chapter' }]
      : []),
  ];

  const running = timer?.kind === 'minutes' ? sleepLabel(timer) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingTop: space.md,
            paddingBottom: insets.bottom + space.md,
          }}
        >
          <View style={[styles.grip, { backgroundColor: colors.divider }]} />
          <Text style={[styles.title, { color: colors.text, fontSize: font.xl, paddingHorizontal: space.xl }]}>
            Sleep timer
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: font.sm,
              paddingHorizontal: space.xl,
              paddingBottom: space.sm,
            }}
          >
            {running
              ? `Stopping in ${running}. Counts only while playing.`
              : 'Fades out, pauses, and keeps your place.'}
          </Text>

          {choices.map(({ label, choice, on }) => (
            <Pressable
              key={label}
              onPress={() => {
                onChoose(choice);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [
                styles.row,
                {
                  paddingHorizontal: space.xl,
                  paddingVertical: space.md,
                  backgroundColor: pressed ? colors.surface : 'transparent',
                },
              ]}
            >
              <Text style={{ flex: 1, color: on ? colors.accent : colors.text, fontSize: font.lg, fontWeight: on ? '700' : '500' }}>
                {label}
              </Text>
              {on && <Ionicons name="checkmark" size={20} color={colors.accent} />}
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  grip: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  title: { fontWeight: '700', paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
