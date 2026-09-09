import { createContext, useContext, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { ExtractorWebView } from '../extraction/ExtractorWebView';
import { addBook } from '../db/books';
import { useTheme } from '../ui/ThemeProvider';

interface ImportContextValue {
  start(): void;
  busy: boolean;
}

const ImportContext = createContext<ImportContextValue | null>(null);

/**
 * Importing a PDF, from wherever the reader happens to be.
 *
 * This used to live inside the library screen, which meant the button had to
 * live there too. Adding a document is the app's primary action and belongs in
 * the middle of the tab bar, so the work moved to where any screen can reach
 * it -- and the extractor now mounts once, at the root, instead of once per
 * visit to a screen.
 */
export function ImportProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { colors, space, radius, font } = useTheme();
  const [importing, setImporting] = useState<{ uri: string; title: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const start = () => {
    if (importing) return;
    void DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    }).then((result) => {
      if (result.canceled) return;
      const asset = result.assets[0];
      setStatus('Reading the document…');
      setImporting({ uri: asset.uri, title: asset.name.replace(/\.pdf$/i, '') });
    });
  };

  return (
    <ImportContext.Provider value={{ start, busy: importing !== null }}>
      {children}

      {status && (
        <View
          style={[
            styles.status,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              padding: space.lg,
              gap: space.md,
            },
          ]}
        >
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.text, fontSize: font.sm, flex: 1 }}>{status}</Text>
        </View>
      )}

      {importing && (
        <ExtractorWebView
          uri={importing.uri}
          onProgress={(page, total) => setStatus(`Reading page ${page} of ${total}…`)}
          onDone={(doc) => {
            const { uri, title } = importing;
            setImporting(null);
            setStatus('Saving…');
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
    </ImportContext.Provider>
  );
}

export function useImport(): ImportContextValue {
  const found = useContext(ImportContext);
  if (!found) throw new Error('useImport was called outside ImportProvider.');
  return found;
}

const styles = StyleSheet.create({
  status: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 92,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
