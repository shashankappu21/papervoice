import React, { useEffect, useRef, useState } from 'react';
import { File } from 'expo-file-system';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { buildSentences } from './sentences';
import { EXTRACTOR_HTML } from './extractorHtml';
import { stagePdfJs } from './pdfjsAssets';
import type { ExtractedDoc, TextItem } from './types';

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
  onCover?: (cover: string | null) => void;
  onError: (message: string) => void;
}

type Message =
  | { type: 'ready' }
  | { type: 'progress'; page: number; total: number }
  | { type: 'error'; message: string }
  | { type: 'cover'; cover: string | null }
  | {
      type: 'items';
      items: TextItem[];
      pageHeight: number;
      pageCount: number;
      /** Page one as base64 JPEG, or null when it could not be drawn. */
      cover: string | null;
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

  const start = async () => {
    try {
      const base64 = await new File(uri).base64();
      const call = mode === 'cover' ? 'window.renderCover' : 'window.extract';
      // One eval carries the whole document; comfortably within the limit for
      // the book-sized PDFs this app imports.
      ref.current?.injectJavaScript(`${call}(${JSON.stringify(base64)}); true;`);
    } catch (error) {
      onError(`Could not read the PDF: ${String(error)}`);
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
        onError(msg.message);
        return;
      case 'cover':
        onCover?.(msg.cover);
        return;
      case 'items':
        onDone({
          sentences: buildSentences(msg.items, msg.pageHeight),
          pageCount: msg.pageCount,
          cover: msg.cover,
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
      style={{ width: 0, height: 0, opacity: 0 }}
      onMessage={handleMessage}
      onError={({ nativeEvent }) => onError(`WebView error: ${nativeEvent.description}`)}
      onRenderProcessGone={() => onError('The extractor ran out of memory on this PDF')}
    />
  );
}
