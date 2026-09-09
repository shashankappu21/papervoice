import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './ThemeProvider';
import { createGroup } from '../db/groups';

interface Props {
  visible: boolean;
  onClose(): void;
  /** Given the new group's id, so the library can select it straight away. */
  onCreated(groupId: number): void;
}

/** Naming a group. Nothing else: adding the books to it comes next. */
export function NewGroupSheet({ visible, onClose, onCreated }: Props) {
  const { colors, space, radius, font } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName('');
      setFailed(null);
    }
  }, [visible]);

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createGroup(trimmed).then(
      (id) => {
        onCreated(id);
        onClose();
      },
      (cause: unknown) => setFailed(String(cause)),
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={() => undefined}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bg,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: space.xl,
              paddingTop: space.md,
              paddingBottom: insets.bottom + space.xl,
            },
          ]}
        >
          <View style={[styles.grip, { backgroundColor: colors.divider }]} />

          <Text style={[styles.title, { color: colors.text, fontSize: font.xl }]}>New group</Text>
          <Text style={{ color: colors.textMuted, fontSize: font.sm, marginTop: 4 }}>
            A book can be in as many groups as you like.
          </Text>

          <View style={[styles.row, { gap: space.sm, marginTop: space.lg }]}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Work, Fiction, To read…"
              placeholderTextColor={colors.textMuted}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={create}
              style={[
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  fontSize: font.md,
                },
              ]}
            />
            <Pressable
              onPress={create}
              disabled={name.trim().length === 0}
              accessibilityRole="button"
              accessibilityLabel="Create group"
              style={({ pressed }) => [
                styles.create,
                {
                  backgroundColor: colors.accent,
                  borderRadius: radius.md,
                  opacity: name.trim().length === 0 ? 0.4 : pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={{ color: colors.accentOn, fontSize: font.md, fontWeight: '700' }}>
                Create
              </Text>
            </Pressable>
          </View>

          {failed && (
            <Text style={{ color: colors.danger, fontSize: font.sm, marginTop: space.sm }}>
              {failed}
            </Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {},
  grip: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  title: { fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, paddingHorizontal: 14, minHeight: 48 },
  create: { minHeight: 48, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
});
