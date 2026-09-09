import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { listBooks, type Book } from '../../src/db/books';
import { bookIdsIn, listGroups, type Group } from '../../src/db/groups';
import { BookMenu } from '../../src/ui/BookMenu';
import { CoverBackfill } from '../../src/import/CoverBackfill';
import { BookCover } from '../../src/ui/BookCover';
import { useTheme } from '../../src/ui/ThemeProvider';

/** Books further along than this have been genuinely started. */
const STARTED = 0;

/** The library: what has been imported, and how far each one has been read. */
export default function Library() {
  const router = useRouter();
  const { colors, space, radius, font } = useTheme();
  const insets = useSafeAreaInsets();
  const [books, setBooks] = useState<Book[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [group, setGroup] = useState<number | null>(null);
  const [inGroup, setInGroup] = useState<Set<number> | null>(null);
  const [menuFor, setMenuFor] = useState<Book | null>(null);
  const [backfilling, setBackfilling] = useState(true);

  // Progress changes while reading, so the list is refreshed on the way back
  // rather than only when it is first built.
  const reload = useCallback(() => {
    listBooks().then(setBooks, (cause: unknown) => setStatus(String(cause)));
    listGroups().then(setGroups, () => setGroups([]));
  }, []);

  useFocusEffect(reload);

  // Which books are in the chosen group. Kept beside the books rather than
  // queried with them, so switching group does not re-read the whole library.
  useEffect(() => {
    if (group === null) {
      setInGroup(null);
      return;
    }
    let cancelled = false;
    bookIdsIn(group).then(
      (ids) => !cancelled && setInGroup(new Set(ids)),
      () => !cancelled && setInGroup(new Set()),
    );
    return () => {
      cancelled = true;
    };
  }, [group, books]);

  const open = (book: Book) =>
    router.push({ pathname: '/reader/[bookId]', params: { bookId: book.id } });

  // A group that has been deleted elsewhere should not leave the library
  // filtered by something no longer in the list.
  const chosen = groups.some((candidate) => candidate.id === group) ? group : null;
  const shown = chosen === null ? books : books.filter((book) => inGroup?.has(book.id) ?? false);
  const started = shown.filter((book) => book.position > STARTED);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.head,
          { paddingHorizontal: space.xl, paddingTop: insets.top + space.sm },
        ]}
      >
        <Text style={[styles.heading, { color: colors.text, fontSize: font.display }]}>
          Library
        </Text>
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={10}
          style={({ pressed }) => [styles.add, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="settings-outline" size={24} color={colors.text} />
        </Pressable>
      </View>

      <FlatList
        data={shown}
        keyExtractor={(book) => String(book.id)}
        contentContainerStyle={{ paddingBottom: space.xxxl }}
        ListHeaderComponent={
          <View>
            {groups.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: space.xl,
                  gap: space.sm,
                  paddingBottom: space.md,
                }}
              >
                <GroupChip label="All" on={chosen === null} onPress={() => setGroup(null)} />
                {groups.map((candidate) => (
                  <GroupChip
                    key={candidate.id}
                    label={`${candidate.name} · ${candidate.count}`}
                    on={chosen === candidate.id}
                    onPress={() => setGroup(chosen === candidate.id ? null : candidate.id)}
                  />
                ))}
              </ScrollView>
            )}

            {started.length > 0 && (
            <View>
              <Text
                style={[
                  styles.section,
                  { color: colors.text, fontSize: font.xl, paddingHorizontal: space.xl },
                ]}
              >
                Continue listening
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.md }}
              >
                {started.map((book) => {
                  const fraction = book.position / Math.max(1, book.sentenceCount);
                  return (
                    <Pressable
                      key={book.id}
                      onPress={() => open(book)}
                      accessibilityRole="button"
                      accessibilityLabel={`${book.title}, ${Math.round(fraction * 100)} percent read`}
                      style={({ pressed }) => [
                        styles.card,
                        {
                          backgroundColor: colors.surface,
                          borderRadius: radius.lg,
                          padding: space.md,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <BookCover title={book.title} uri={book.coverPath} width={124} height={166} />
                      <Text
                        numberOfLines={2}
                        style={{
                          color: colors.text,
                          fontSize: font.md,
                          fontWeight: '700',
                          marginTop: space.sm,
                        }}
                      >
                        {book.title}
                      </Text>
                      <View style={[styles.track, { backgroundColor: colors.divider }]}>
                        <View
                          style={[
                            styles.fill,
                            {
                              width: `${Math.max(2, fraction * 100)}%`,
                              backgroundColor: colors.accent,
                            },
                          ]}
                        />
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text
                style={[
                  styles.section,
                  {
                    color: colors.text,
                    fontSize: font.xl,
                    paddingHorizontal: space.xl,
                    marginTop: space.xxl,
                  },
                ]}
              >
                All books
              </Text>
            </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={{ padding: space.xxxl, alignItems: 'center' }}>
            <Ionicons name="book-outline" size={48} color={colors.textMuted} />
            <Text
              style={{
                color: colors.text,
                fontSize: font.xl,
                fontWeight: '700',
                marginTop: space.lg,
              }}
            >
              Nothing here yet
            </Text>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: font.md,
                textAlign: 'center',
                marginTop: space.sm,
                lineHeight: 21,
              }}
            >
              Import a PDF and it will be read to you — entirely on this phone.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const percent = Math.round((item.position / Math.max(1, item.sentenceCount)) * 100);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.title}, ${percent} percent read`}
              style={({ pressed }) => [
                styles.row,
                {
                  paddingHorizontal: space.xl,
                  paddingVertical: space.md,
                  backgroundColor: pressed ? colors.surface : 'transparent',
                },
              ]}
              onPress={() => open(item)}
            >
              <BookCover title={item.title} uri={item.coverPath} width={52} height={70} />
              <View style={styles.rowText}>
                <Text
                  numberOfLines={2}
                  style={{ color: colors.text, fontSize: font.lg, fontWeight: '600' }}
                >
                  {item.title}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: font.sm, marginTop: 3 }}>
                  {item.position > 0 ? `${percent}% · ` : ''}
                  {item.pageCount} pages
                </Text>
              </View>
              <Pressable
                onPress={() => setMenuFor(item)}
                accessibilityRole="button"
                accessibilityLabel={`More options for ${item.title}`}
                hitSlop={12}
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
              >
                <Ionicons name="ellipsis-horizontal" size={22} color={colors.textMuted} />
              </Pressable>
            </Pressable>
          );
        }}
      />

      <BookMenu book={menuFor} onClose={() => setMenuFor(null)} onChanged={reload} />

      {/* Runs once per launch and stops as soon as every book has a picture. */}
      {backfilling && (
        <CoverBackfill
          onDone={() => {
            setBackfilling(false);
            reload();
          }}
        />
      )}
    </View>
  );
}

function GroupChip({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  const { colors, radius, font } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [
        chipStyles.chip,
        {
          backgroundColor: on ? colors.accent : colors.surface,
          borderRadius: radius.pill,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: on ? colors.accentOn : colors.text,
          fontSize: font.sm,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  chip: { minHeight: 36, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontWeight: '800', letterSpacing: -0.5 },
  add: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  section: { fontWeight: '700', paddingBottom: 12, paddingTop: 8 },
  card: { width: 148 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 8 },
  fill: { height: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowText: { flex: 1 },
});
