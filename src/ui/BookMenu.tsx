import { useEffect, useState } from 'react';
import {
  Alert,
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
import { deleteBook, type Book } from '../db/books';
import { createGroup, groupsOf, listGroups, setBookGroup, type Group } from '../db/groups';
import { useKeyboardHeight } from './useKeyboardHeight';

interface Props {
  book: Book | null;
  onClose(): void;
  /** Something changed that the library needs to re-read. */
  onChanged(): void;
}

/** What can be done to one book: which groups it is in, and removing it. */
export function BookMenu({ book, onClose, onChanged }: Props) {
  const { colors, space, radius, font } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const [groups, setGroups] = useState<Group[]>([]);
  const [member, setMember] = useState<Set<number>>(new Set());
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    if (!book) return;
    setNaming(false);
    setName('');
    void listGroups().then(setGroups, () => setGroups([]));
    void groupsOf(book.id).then((ids) => setMember(new Set(ids)), () => setMember(new Set()));
  }, [book]);

  if (!book) return null;

  const toggle = async (group: Group) => {
    const on = !member.has(group.id);
    setMember((current) => {
      const next = new Set(current);
      if (on) next.add(group.id);
      else next.delete(group.id);
      return next;
    });
    await setBookGroup(book.id, group.id, on);
    onChanged();
  };

  const addGroup = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = await createGroup(trimmed);
    await setBookGroup(book.id, id, true);
    setName('');
    setNaming(false);
    setGroups(await listGroups());
    setMember((current) => new Set(current).add(id));
    onChanged();
  };

  const confirmRemove = () => {
    Alert.alert(
      'Remove this book?',
      // Says what is actually lost. "Are you sure?" tells nobody anything.
      `"${book.title}" and your place in it will be deleted from this phone. The original PDF where you imported it from is untouched.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void deleteBook(book.id).then(() => {
              onChanged();
              onClose();
            });
          },
        },
      ],
    );
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={() => undefined}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bg,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingTop: space.md,
              paddingBottom: keyboard > 0 ? space.sm : insets.bottom + space.lg,
              marginBottom: keyboard,
              // With the keyboard up there is far less room, and the sheet
              // must give way rather than push the field off the screen.
              maxHeight: keyboard > 0 ? '54%' : '80%',
            },
          ]}
        >
          <View style={[styles.grip, { backgroundColor: colors.divider }]} />

          <Text
            numberOfLines={2}
            style={[
              styles.title,
              { color: colors.text, fontSize: font.lg, paddingHorizontal: space.xl },
            ]}
          >
            {book.title}
          </Text>

          <Text
            style={[
              styles.section,
              { color: colors.textMuted, fontSize: font.xs, paddingHorizontal: space.xl },
            ]}
          >
            GROUPS
          </Text>

          <ScrollView style={styles.groups}>
            {groups.map((group) => {
              const on = member.has(group.id);
              return (
                <Pressable
                  key={group.id}
                  onPress={() => void toggle(group)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      paddingHorizontal: space.xl,
                      paddingVertical: space.md,
                      backgroundColor: pressed ? colors.surface : 'transparent',
                    },
                  ]}
                >
                  <Ionicons
                    name={on ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={on ? colors.accent : colors.textMuted}
                  />
                  <Text style={{ color: colors.text, fontSize: font.md, flex: 1 }}>
                    {group.name}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: font.sm }}>{group.count}</Text>
                </Pressable>
              );
            })}

            {groups.length === 0 && !naming && (
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: font.sm,
                  paddingHorizontal: space.xl,
                  paddingBottom: space.sm,
                }}
              >
                No groups yet.
              </Text>
            )}

            {naming ? (
              <View style={[styles.newRow, { paddingHorizontal: space.xl, gap: space.sm }]}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Group name"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                  onSubmitEditing={() => void addGroup()}
                  returnKeyType="done"
                  style={[
                    styles.input,
                    {
                      color: colors.text,
                      backgroundColor: colors.surface,
                      borderRadius: radius.sm,
                      fontSize: font.md,
                    },
                  ]}
                />
                <Pressable
                  onPress={() => void addGroup()}
                  accessibilityRole="button"
                  accessibilityLabel="Create group"
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <Ionicons name="checkmark-circle" size={32} color={colors.accent} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setNaming(true)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.row,
                  {
                    paddingHorizontal: space.xl,
                    paddingVertical: space.md,
                    backgroundColor: pressed ? colors.surface : 'transparent',
                  },
                ]}
              >
                <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
                <Text style={{ color: colors.accent, fontSize: font.md, fontWeight: '600' }}>
                  New group
                </Text>
              </Pressable>
            )}
          </ScrollView>

          <Pressable
            onPress={confirmRemove}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.row,
              {
                paddingHorizontal: space.xl,
                paddingVertical: space.lg,
                borderTopWidth: 1,
                borderTopColor: colors.divider,
                backgroundColor: pressed ? colors.surface : 'transparent',
              },
            ]}
          >
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
            <Text style={{ color: colors.danger, fontSize: font.md, fontWeight: '600' }}>
              Remove from library
            </Text>
          </Pressable>
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
  section: { fontWeight: '700', letterSpacing: 0.5, marginTop: 18, marginBottom: 4 },
  groups: { flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  newRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  input: { flex: 1, paddingHorizontal: 12, minHeight: 44 },
});
