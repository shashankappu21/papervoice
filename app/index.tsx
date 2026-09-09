import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { ExtractorWebView } from '../src/extraction/ExtractorWebView';
import { addBook, listBooks, type Book } from '../src/db/books';
import { Button } from '../src/ui/Button';
import { useTheme } from '../src/ui/ThemeProvider';

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/** The library: what has been imported, and how far each one has been read. */
export default function Library() {
  const router = useRouter();
  const { colors, space, radius, font } = useTheme();
  const [books, setBooks] = useState<Book[]>([]);
  const [importing, setImporting] = useState<{ uri: string; title: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Progress changes while reading, so the list is refreshed on the way back
  // rather than only when it is first built.
  useFocusEffect(
    useCallback(() => {
      listBooks().then(setBooks, (cause: unknown) => setStatus(String(cause)));
    }, []),
  );

  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setStatus('Reading the document...');
    setImporting({ uri: asset.uri, title: asset.name.replace(/\.pdf$/i, '') });
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <FlatList
        data={books}
        keyExtractor={(book) => String(book.id)}
        contentContainerStyle={{ paddingVertical: space.md }}
        ListEmptyComponent={
          <View style={{ padding: space.xxxl }}>
            <Text style={{ color: colors.text, fontSize: font.lg, textAlign: 'center' }}>
              Nothing here yet.
            </Text>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: font.md,
                textAlign: 'center',
                marginTop: space.sm,
              }}
            >
              Import a PDF and it will be read to you.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const fraction = item.position / Math.max(1, item.sentenceCount);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.title}, ${Math.round(fraction * 100)} percent read`}
              style={({ pressed }) => [
                styles.book,
                {
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  marginHorizontal: space.md,
                  marginBottom: space.md,
                  padding: space.lg,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              onPress={() =>
                router.push({ pathname: '/reader/[bookId]', params: { bookId: item.id } })
              }
            >
              <Text style={[styles.title, { color: colors.text, fontSize: font.lg }]}>
                {item.title}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: font.sm, marginTop: 2 }}>
                {plural(item.pageCount, 'page')} · {plural(item.sentenceCount, 'sentence')}
              </Text>

              {item.position > 0 && (
                <View style={[styles.progressRow, { marginTop: space.sm }]}>
                  <View style={[styles.track, { backgroundColor: colors.divider }]}>
                    {/*
                      A long book is barely started for its first hundred
                      sentences, and a bar that rounds to nothing looks like a
                      book never opened. The fill keeps a sliver so that having
                      started is visible at all.
                    */}
                    <View
                      style={[
                        styles.fill,
                        { width: `${Math.max(1, fraction * 100)}%`, backgroundColor: colors.accent },
                      ]}
                    />
                  </View>
                  <Text
                    style={[styles.progressText, { color: colors.textMuted, fontSize: font.xs }]}
                  >
                    {item.position + 1} / {item.sentenceCount}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />

      <View
        style={[
          styles.footer,
          { borderTopColor: colors.divider, padding: space.md, gap: space.sm },
        ]}
      >
        <Button title="Import a PDF" onPress={() => void pick()} disabled={importing !== null} />
        {status && (
          <Text style={{ color: colors.textMuted, fontSize: font.sm }}>{status}</Text>
        )}
      </View>

      {importing && (
        <ExtractorWebView
          uri={importing.uri}
          onProgress={(page, total) => setStatus(`Reading page ${page} of ${total}...`)}
          onDone={(doc) => {
            const { uri, title } = importing;
            setImporting(null);
            setStatus('Saving...');
            addBook(uri, title, doc).then(
              (book) => {
                setStatus(null);
                router.push({ pathname: '/reader/[bookId]', params: { bookId: book.id } });
              },
              (cause: unknown) => setStatus(`Could not save: ${String(cause)}`),
            );
          }}
          onError={(message) => {
            setImporting(null);
            setStatus(`Could not read that PDF: ${message}`);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  book: {},
  title: { fontWeight: '600' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 3 },
  progressText: { fontVariant: ['tabular-nums'] },
  footer: { borderTopWidth: 1 },
});
