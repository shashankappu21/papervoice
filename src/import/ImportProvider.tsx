import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { File, Paths } from 'expo-file-system';
import { Asset } from 'expo-asset';
import { getSetting, setSetting } from '../db/settings';
import {
  afterFailure,
  shouldImport,
  STARTER_BOOK_ID,
  STARTER_STATE,
  STARTER_TITLE,
} from './starter';

import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { ExtractorWebView } from '../extraction/ExtractorWebView';
import { addBook, findBookByHash } from '../db/books';
import { SherpaTts } from '../../modules/sherpa-tts';
import { ImportProgress } from '../ui/ImportProgress';
import { titleFromUri } from './incomingPdf';
import { onImportOffered } from './pendingImport';

interface ImportContextValue {
  start(): void;
  busy: boolean;
  /** Goes up when a book arrives without anyone asking -- the starter book. */
  revision: number;
  /** True while the starter book is being prepared. */
  preparingStarter: boolean;
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
  const [importing, setImporting] = useState<{
    uri: string;
    title: string;
    hash: string | null;
    /**
     * The starter book: no progress card, no opening the reader, and failure
     * is recorded for a later retry rather than shown.
     */
    silent?: boolean;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const [preparingStarter, setPreparingStarter] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  /** Pages read and pages in total, so the wait has a shape rather than a spinner. */
  const [pages, setPages] = useState({ page: 0, total: 0 });
  const [failed, setFailed] = useState<string | null>(null);
  /** Held after extraction finishes, so the card covers the save too. */
  const [saving, setSaving] = useState(false);
  /** Uris already taken, so a re-launch does not import the same file twice. */
  const taken = useRef(new Set<string>());

  /*
   * The document is identified before it is read.
   *
   * Importing the same PDF twice used to make two books, because the only
   * thing a book was known by was its uri -- and both ways in produce a fresh
   * uri every time: the share sheet mints one per launch, the picker copies to
   * a new cache name. Hashing the bytes is what tells the two cases apart.
   *
   * Done first, before extraction rather than after, because extraction is the
   * expensive part and there is no sense reading a hundred megabytes to
   * discover the answer was already in the library.
   */
  const begin = useCallback(
    async (uri: string, title: string) => {
      setFailed(null);
      setPages({ page: 0, total: 0 });
      setStatus('Opening the document…');

      let hash: string | null = null;
      try {
        hash = await SherpaTts.sha256(uri.replace(/^file:\/\//, ''));
      } catch {
        // A hash that cannot be taken must not stop an import. The worst case
        // is the old behaviour: a duplicate that is not spotted.
        hash = null;
      }

      if (hash) {
        const already = await findBookByHash(hash).catch(() => null);
        if (already) {
          // Opened rather than refused. Someone who picks a document they
          // already have almost certainly means to read it.
          setStatus(null);
          router.push({ pathname: '/reader/[bookId]', params: { bookId: already.id } });
          return;
        }
      }

      setImporting({ uri, title, hash });
    },
    [router],
  );

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
        // copySync, because what follows reads the file immediately. The async
        // copy() returns before the bytes are there, and hashing a file that is
        // still being written gives the wrong answer or none at all.
        new File(uri).copySync(copy);
        void begin(copy.uri, titleFromUri(uri));
      } catch (cause) {
        setFailed(`That file could not be opened: ${String(cause)}`);
      }
    },
    [begin],
  );

  // Documents come through the router rather than through Linking, because
  // the router sees them first and would otherwise try to navigate to them.
  useEffect(() => onImportOffered(receive), [receive]);

  /*
   * The starter book, on a new install's first launches.
   *
   * Copied out of the app's assets and read by the same extractor as any
   * other PDF, so it is a book like the rest: it can be deleted, grouped,
   * and its place is saved.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const state = await getSetting(STARTER_STATE);
      if (!shouldImport(state) || cancelled) return;
      setPreparingStarter(true);
      try {
        const asset = Asset.fromModule(require('../../assets/books/three-stories.pdf'));
        await asset.downloadAsync();
        if (!asset.localUri) throw new Error('the starter book has no local copy');
        const copy = new File(Paths.cache, `starter-${Date.now()}.pdf`);
        new File(asset.localUri).copySync(copy);
        if (!cancelled) setImporting({ uri: copy.uri, title: STARTER_TITLE, hash: null, silent: true });
      } catch (cause) {
        console.log('[papervoice] starter book could not be staged:', String(cause));
        await setSetting(STARTER_STATE, afterFailure(state)).catch(() => undefined);
        setPreparingStarter(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const start = () => {
    // The starter book is quick, but someone may tap + while it is reading.
    // It is set aside rather than made to wait: tried again next launch.
    if (importing?.silent) {
      setImporting(null);
      setPreparingStarter(false);
      void getSetting(STARTER_STATE).then((state) =>
        setSetting(STARTER_STATE, afterFailure(state)),
      );
    } else if (importing) return;
    void DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    }).then((result) => {
      if (result.canceled) return;
      const asset = result.assets[0];
      void begin(asset.uri, asset.name.replace(/\.pdf$/i, ''));
    });
  };

  return (
    <ImportContext.Provider
      value={{ start, busy: importing !== null && !importing.silent, revision, preparingStarter }}
    >
      {children}

      {((importing && !importing.silent) || failed || saving) && (
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
            const { uri, title, hash } = importing;
            setImporting(null);
            if (importing.silent) {
              addBook(uri, title, doc, hash)
                .then(async (book) => {
                  await setSetting(STARTER_BOOK_ID, String(book.id));
                  await setSetting(STARTER_STATE, 'done');
                  setRevision((n) => n + 1);
                })
                .catch(async (cause: unknown) => {
                  console.log('[papervoice] starter book could not be saved:', String(cause));
                  const state = await getSetting(STARTER_STATE);
                  await setSetting(STARTER_STATE, afterFailure(state));
                })
                .finally(() => setPreparingStarter(false));
              return;
            }
            setSaving(true);
            setStatus('Saving…');
            addBook(uri, title, doc, hash).then(
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
            if (importing.silent) {
              setImporting(null);
              setPreparingStarter(false);
              console.log('[papervoice] starter book could not be read:', message);
              void getSetting(STARTER_STATE).then((state) =>
                setSetting(STARTER_STATE, afterFailure(state)),
              );
              return;
            }
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
