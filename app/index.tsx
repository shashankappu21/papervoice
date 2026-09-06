import { useCallback, useState } from 'react';
import { Button, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { ExtractorWebView } from '../src/extraction/ExtractorWebView';
import { addBook, listBooks, type Book } from '../src/db/books';

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/** The library: what has been imported, and how far each one has been read. */
export default function Library() {
  const router = useRouter();
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
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Library' }} />

      <FlatList
        data={books}
        keyExtractor={(book) => String(book.id)}
        ListEmptyComponent={
          <Text style={styles.empty}>Nothing here yet. Import a PDF to start.</Text>
        }
        renderItem={({ item }) => {
          const fraction = item.position / Math.max(1, item.sentenceCount);
          return (
            <Pressable
              style={styles.book}
              onPress={() =>
                router.push({ pathname: '/reader/[bookId]', params: { bookId: item.id } })
              }
            >
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.detail}>
                {plural(item.pageCount, 'page')} · {plural(item.sentenceCount, 'sentence')}
              </Text>

              {item.position > 0 && (
                <View style={styles.progressRow}>
                  <View style={styles.track}>
                    {/*
                      A long book is barely started for its first hundred
                      sentences, and a bar that rounds to nothing looks like a
                      book never opened. The fill keeps a sliver so that having
                      started is visible at all.
                    */}
                    <View style={[styles.fill, { width: `${Math.max(1, fraction * 100)}%` }]} />
                  </View>
                  <Text style={styles.progressText}>
                    {item.position + 1} / {item.sentenceCount}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />

      <View style={styles.footer}>
        <Button title="Import a PDF" onPress={() => void pick()} disabled={importing !== null} />
        {status && <Text style={styles.status}>{status}</Text>}
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
  empty: { padding: 32, textAlign: 'center', color: '#777' },
  book: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 17, fontWeight: '600' },
  detail: { fontSize: 13, color: '#777', marginTop: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  track: { flex: 1, height: 3, backgroundColor: '#e4e4e4', borderRadius: 2, overflow: 'hidden' },
  fill: { height: 3, backgroundColor: '#2f95dc' },
  progressText: { fontSize: 12, color: '#999', fontVariant: ['tabular-nums'] },
  footer: { borderTopWidth: 1, borderTopColor: '#e2e2e2', padding: 12, gap: 6 },
  status: { fontSize: 13, color: '#444' },
});
