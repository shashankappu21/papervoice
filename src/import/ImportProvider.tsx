import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { File, Paths } from 'expo-file-system';

import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { ExtractorWebView } from '../extraction/ExtractorWebView';
import { addBook } from '../db/books';
import { ImportProgress } from '../ui/ImportProgress';
import { titleFromUri } from './incomingPdf';
import { onImportOffered } from './pendingImport';

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
  /** Uris already taken, so a re-launch does not import the same file twice. */
  const taken = useRef(new Set<string>());

  const begin = useCallback((uri: string, title: string) => {
    setFailed(null);
    setPages({ page: 0, total: 0 });
    setStatus('Opening the document…');
    setImporting({ uri, title });
  }, []);

  /**
   * A PDF opened from somewhere else -- a file manager, a share sheet.
   *
   * The uri is copied into the app's own storage before anything is done with
   * it. What Android grants along with the intent is permission to read that
   * one uri for as long as this launch lasts; it does not survive the app
   * being killed, and the import has to outlive that.
   */
  const receive = useCallback(
    (uri: string) => {
      // The same file manager entry opened twice in one session is the same
      // document, not two.
      if (taken.current.has(uri)) return;
      taken.current.add(uri);

      try {
        const copy = new File(Paths.cache, `incoming-${Date.now()}.pdf`);
        new File(uri).copy(copy);
        begin(copy.uri, titleFromUri(uri));
      } catch (cause) {
        setFailed(`That file could not be opened: ${String(cause)}`);
      }
    },
    [begin],
  );

  // Documents come through the router rather than through Linking, because
  // the router sees them first and would otherwise try to navigate to them.
  useEffect(() => onImportOffered(receive), [receive]);

  const start = () => {
    if (importing) return;
    void DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    }).then((result) => {
      if (result.canceled) return;
      const asset = result.assets[0];
      begin(asset.uri, asset.name.replace(/\.pdf$/i, ''));
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
