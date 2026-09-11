import { createContext, useContext, useState } from 'react';

import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { ExtractorWebView } from '../extraction/ExtractorWebView';
import { addBook } from '../db/books';
import { ImportProgress } from '../ui/ImportProgress';

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
  const [importing, setImporting] = useState<{ uri: string; title: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  /** Pages read and pages in total, so the wait has a shape rather than a spinner. */
  const [pages, setPages] = useState({ page: 0, total: 0 });
  const [failed, setFailed] = useState<string | null>(null);
  /** Held after extraction finishes, so the card covers the save too. */
  const [saving, setSaving] = useState(false);

  const start = () => {
    if (importing) return;
    void DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    }).then((result) => {
      if (result.canceled) return;
      const asset = result.assets[0];
      setFailed(null);
      setPages({ page: 0, total: 0 });
      setStatus('Opening the document…');
      setImporting({ uri: asset.uri, title: asset.name.replace(/\.pdf$/i, '') });
    });
  };

  return (
    <ImportContext.Provider value={{ start, busy: importing !== null }}>
      {children}

      {(importing || failed || saving) && (
        <ImportProgress
          title={importing?.title ?? ''}
          page={pages.page}
          total={pages.total}
          message={failed ?? status}
          failed={failed !== null}
          onDismiss={() => {
            setFailed(null);
            setStatus(null);
          }}
        />
      )}

      {importing && (
        <ExtractorWebView
          uri={importing.uri}
          onProgress={(page, total) => setPages({ page, total })}
          onDone={(doc) => {
            const { uri, title } = importing;
            setImporting(null);
            setSaving(true);
            setStatus('Saving…');
            addBook(uri, title, doc).then(
              (book) => {
                setSaving(false);
                setStatus(null);
                router.push({ pathname: '/reader/[bookId]', params: { bookId: book.id } });
              },
              (cause: unknown) => {
                setSaving(false);
                setFailed(String(cause));
              },
            );
          }}
          onError={(message) => {
            setImporting(null);
            setSaving(false);
            setFailed(message);
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
