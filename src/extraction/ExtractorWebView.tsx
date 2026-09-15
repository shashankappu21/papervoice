import React, { useEffect, useRef, useState } from 'react';
import { File } from 'expo-file-system';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { buildSentences } from './sentences';
import { EXTRACTOR_HTML } from './extractorHtml';
import { stagePdfJs } from './pdfjsAssets';
import type { ExtractedDoc, TextItem } from './types';
import { StyleSheet } from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import type { OutlineEntry } from './sections';

/**
 * What the document is called while the extractor reads it.
 *
 * One fixed name in the staged directory, beside pdf.js, so the page can open
 * it with a relative URL. Only one extraction runs at a time -- the importer
 * is a single screen -- so a name per document would buy nothing.
 */
const DOCUMENT = 'document.pdf';

interface Props {
  /** `file://` URI of the PDF to extract. */
  uri: string;
  onProgress?: (page: number, total: number) => void;
  onDone: (doc: ExtractedDoc) => void;
  /**
   * 'cover' draws page one and stops. Used to give books imported before
   * covers existed a picture, without re-reading every page of them.
   */
  mode?: 'full' | 'cover';
  onCover?: (cover: string | null, outline: OutlineEntry[]) => void;
  onError: (message: string) => void;
}

type Message =
  | { type: 'ready' }
  | { type: 'progress'; page: number; total: number }
  | { type: 'error'; message: string }
  | { type: 'cover'; cover: string | null; outline?: OutlineEntry[] }
  | {
      type: 'items';
      items: TextItem[];
      pageHeight: number;
      pageCount: number;
      /** Page one as base64 JPEG, or null when it could not be drawn. */
      cover: string | null;
      outline?: OutlineEntry[];
    };

/**
 * Renders a zero-sized WebView that runs pdf.js over one PDF and reports the
 * sentences back. Nothing is displayed; mount it while an import is in flight
 * and unmount it when `onDone` or `onError` fires.
 */
export function ExtractorWebView({
  uri,
  onProgress,
  onDone,
  onError,
  mode = 'full',
  onCover,
}: Props) {
  const ref = useRef<WebView>(null);
  const started = useRef(false);
  const { colors } = useTheme();
  const [baseUrl, setBaseUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    stagePdfJs().then(
      (dir) => {
        if (!cancelled) setBaseUrl(dir);
      },
      (error: unknown) => {
        if (!cancelled) onError(`Could not prepare pdf.js: ${String(error)}`);
      }
    );
    return () => {
      cancelled = true;
    };
    // onError is intentionally not a dependency: staging runs once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * The document is put beside the page and opened by name.
   *
   * It used to be read into base64 and injected as a line of JavaScript
   * carrying the whole file. The comment here said that was "comfortably
   * within the limit for the book-sized PDFs this app imports", and for a
   * two-megabyte book it was. An 80MB one becomes a 107MB base64 string,
   * stringified again as JS source, pushed across the bridge and decoded into
   * a third copy inside the WebView -- and the import simply stopped.
   *
   * Copied rather than referenced in place because the incoming URI is often a
   * content:// from another app's share sheet, which the WebView cannot fetch.
   * A copy costs disk, which phones have, instead of heap, which they do not.
   */
  const start = async () => {
    const staged = new File(`${baseUrl}${DOCUMENT}`);
    try {
      if (staged.exists) staged.delete();
      // Awaited. copy() returns a promise, and firing the extractor without
      // waiting for it handed pdf.js a file that existed and held nothing --
      // which it reported as "Invalid PDF structure", since an empty file is
      // not a well-formed one.
      await new File(uri).copy(staged);
    } catch (error) {
      onError(`Could not read the PDF: ${String(error)}`);
      return;
    }

    /*
     * Checked rather than assumed, because the failure above was silent.
     * A copy that produces nothing is worth saying plainly; letting pdf.js
     * discover it turns a file-handling problem into a complaint about the
     * document, and sends whoever reads the message looking in the wrong place.
     */
    if (!staged.exists || staged.size === 0) {
      onError('The PDF could not be copied for reading, and came out empty.');
      return;
    }

    try {
      const call = mode === 'cover' ? 'window.renderCover' : 'window.extract';
      // A file name, so the injected script stays a few dozen bytes whatever
      // the document weighs.
      ref.current?.injectJavaScript(`${call}(${JSON.stringify(DOCUMENT)}); true;`);
    } catch (error) {
      onError(`Could not start the extractor: ${String(error)}`);
    }
  };

  /*
   * Removed once the extractor is done with it, whichever way it ended. A
   * spare copy of every imported book in the cache directory would be a
   * surprising amount of somebody's storage.
   */
  const discard = () => {
    try {
      const staged = new File(`${baseUrl}${DOCUMENT}`);
      if (staged.exists) staged.delete();
    } catch {
      // The cache directory is the system's to clear if this fails.
    }
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    let msg: Message;
    try {
      msg = JSON.parse(event.nativeEvent.data) as Message;
    } catch {
      onError('The extractor sent a malformed message');
      return;
    }

    switch (msg.type) {
      case 'ready':
        // The page can announce itself again after a reload; extract once.
        if (started.current) return;
        started.current = true;
        void start();
        return;
      case 'progress':
        onProgress?.(msg.page, msg.total);
        return;
      case 'error':
        discard();
        onError(msg.message);
        return;
      case 'cover':
        discard();
        onCover?.(msg.cover, msg.outline ?? []);
        return;
      case 'items':
        discard();
        onDone({
          sentences: buildSentences(msg.items, msg.pageHeight),
          pageCount: msg.pageCount,
          cover: msg.cover,
          outline: msg.outline ?? [],
        });
        return;
    }
  };

  if (!baseUrl) return null;

  return (
    <WebView
      ref={ref}
      source={{ html: EXTRACTOR_HTML, baseUrl }}
      originWhitelist={['*']}
      allowFileAccess
      allowFileAccessFromFileURLs
      javaScriptEnabled
      // A document must never reach the network, and pdf.js never needs to.
      onShouldStartLoadWithRequest={(request) => !/^https?:/i.test(request.url)}
      /*
       * Parked off the screen rather than merely sized to nothing.
       *
       * A zero-sized, zero-opacity WebView still had its surface painted on
       * Android, and since the page underneath is white it appeared as a pale
       * block behind the import card. A view positioned outside the window has
       * nowhere to paint, which is the part that does not depend on how the
       * platform treats an invisible one. The transparent background is the
       * second line of defence (in the style, since this version of the
       * component has no backgroundColor prop), and the page sets one too.
       */
      /*
       * Painted the app's own background colour, having given up on hiding it.
       *
       * Sized to nothing, made transparent, moved ten thousand pixels off the
       * edge and forced onto a software layer -- and Android still composited
       * its surface over the screen. Measured each time from a screenshot as
       * exactly rgb(113,113,113), which is white under the import card's 55%
       * scrim.
       *
       * `transparent` is part of why: an Android WebView surface needs some
       * colour, and falls back to white when told to have none. Given a real
       * colour it uses that one, so the thing that gets composited is the same
       * shade as the screen behind it and there is nothing to see. This does
       * not depend on where the view is or how the platform treats an
       * invisible one, which every previous attempt did.
       */
      style={[styles.offscreen, { backgroundColor: colors.bg }]}
      /*
       * Software layer, which is what finally stopped it being visible.
       *
       * On Android a WebView takes a hardware layer of its own, and that
       * surface is composited by the system rather than laid out by React
       * Native -- so it kept painting its white page over the screen even when
       * the view was sized to nothing, made fully transparent, and moved ten
       * thousand pixels off the edge. Measured from a screenshot: the block was
       * exactly rgb(113,113,113), which is white seen through the import
       * card's 55% scrim.
       *
       * On a software layer it has no surface of its own and simply draws where
       * it is told, which is nowhere. Slower to render, and there is nothing
       * here to render.
       */
      androidLayerType="software"
      onMessage={handleMessage}
      onError={({ nativeEvent }) => onError(`WebView error: ${nativeEvent.description}`)}
      onRenderProcessGone={() => onError('The extractor ran out of memory on this PDF')}
    />
  );
}

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    left: -10_000,
    top: -10_000,
    width: 1,
    height: 1,
    opacity: 0,
  },
});
