import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './ThemeProvider';
import { BookCover } from './BookCover';
import type { Book } from '../db/books';
import { bookIdsIn, deleteGroup, setBookGroup, type Group } from '../db/groups';

interface Props {
  group: Group | null;
  books: Book[];
  onClose(): void;
  onChanged(): void;
  /** Called after the group itself is deleted, so the filter can be cleared. */
  onDeleted(): void;
}

/**
 * Which books are in a group, changed by tapping them.
 *
 * Ticking here rather than opening each book in turn: filling a new group is
 * one decision about several books, and making it one book at a time turns a
 * moment's work into a chore.
 */
export function GroupBooksSheet({ group, books, onClose, onChanged, onDeleted }: Props) {
  const { colors, space, radius, font } = useTheme();
  const insets = useSafeAreaInsets();
  const [member, setMember] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!group) return;
    bookIdsIn(group.id).then(
      (ids) => setMember(new Set(ids)),
      () => setMember(new Set()),
    );
  }, [group]);

  if (!group) return null;

  const toggle = async (book: Book) => {
    const on = !member.has(book.id);
    setMember((current) => {
      const next = new Set(current);
      if (on) next.add(book.id);
      else next.delete(book.id);
      return next;
    });
    await setBookGroup(book.id, group.id, on);
    onChanged();
  };

  const confirmDelete = () => {
    Alert.alert(
      `Delete "${group.name}"?`,
      // The distinction that matters: this is a label, not a shelf the books
      // live on, so removing it does not remove them.
      'The group is removed. The books in it stay in your library.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete group',
          style: 'destructive',
          onPress: () => {
            void deleteGroup(group.id).then(() => {
              onChanged();
              onDeleted();
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
              paddingBottom: insets.bottom + space.sm,
            },
          ]}
        >
          <View style={[styles.grip, { backgroundColor: colors.divider }]} />

          <View style={[styles.head, { paddingHorizontal: space.xl }]}>
            <View style={styles.headText}>
              <Text numberOfLines={1} style={{ color: colors.text, fontSize: font.xl, fontWeight: '700' }}>
                {group.name}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: font.sm, marginTop: 2 }}>
                {member.size === 0
                  ? 'Tap the books that belong here'
                  : `${member.size} ${member.size === 1 ? 'book' : 'books'}`}
              </Text>
            </View>
            <Pressable
              onPress={confirmDelete}
              accessibilityRole="button"
              accessibilityLabel={`Delete the group ${group.name}`}
              hitSlop={10}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </Pressable>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: space.lg }}>
            {books.map((book) => {
              const on = member.has(book.id);
              return (
                <Pressable
                  key={book.id}
                  onPress={() => void toggle(book)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={book.title}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      paddingHorizontal: space.xl,
                      paddingVertical: space.sm,
                      gap: space.md,
                      backgroundColor: pressed ? colors.surface : 'transparent',
                    },
                  ]}
                >
                  <BookCover title={book.title} uri={book.coverPath} width={38} height={50} />
                  <Text
                    numberOfLines={2}
                    style={{ color: colors.text, fontSize: font.md, flex: 1 }}
                  >
                    {book.title}
                  </Text>
                  <Ionicons
                    name={on ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={on ? colors.accent : colors.textMuted}
                  />
                </Pressable>
              );
            })}

            {books.length === 0 && (
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: font.md,
                  padding: space.xl,
                }}
              >
                Import a PDF first, then you can put it in here.
              </Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '82%' },
  grip: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12 },
  headText: { flex: 1 },
  list: { flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
