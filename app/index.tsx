import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ExtractorWebView } from '../src/extraction/ExtractorWebView';
import { findMainContentStart } from '../src/extraction/mainContent';
import type { ExtractedDoc, Sentence } from '../src/extraction/types';
import { usePlayback, RATE_RANGE } from '../src/player/usePlayback';
import { SentenceList } from '../src/ui/SentenceList';

/**
 * A stable empty list. A fresh `[]` on every render would rebuild the synthesis
 * queue each time, tearing down the loaded voice along with it.
 */
const NO_SENTENCES: Sentence[] = [];

const FONT_SIZE = 18;

/**
 * The reader. Still reached by picking a file rather than from a library, which
 * arrives with the books themselves.
 */
export default function Reader() {
  const [uri, setUri] = useState<string | null>(null);
  const [status, setStatus] = useState('Pick a PDF to read.');
  const [doc, setDoc] = useState<ExtractedDoc | null>(null);
  // Where the book's own content starts, when there is front matter to skip.
  // Null means there is nothing to skip, and no button for it.
  const [skipTo, setSkipTo] = useState<number | null>(null);

  const sentences = doc?.sentences ?? NO_SENTENCES;
  const playback = usePlayback(sentences, 'Papervoice');

  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    setDoc(null);
    setSkipTo(null);
    setStatus('Extracting...');
    setUri(result.assets[0].uri);
  };

  const message =
    playback.error ??
    (playback.loadingVoice
      ? 'Loading the voice...'
      : playback.buffering
        ? 'Synthesising...'
        : status);

  return (
    <View style={styles.screen}>
      {doc ? (
        <SentenceList
          sentences={sentences}
          currentIndex={playback.currentIndex}
          onJump={(index) => void playback.jumpTo(index)}
          fontSize={FONT_SIZE}
          following={playback.playing}
        />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.status}>{message}</Text>
        </View>
      )}

      <View style={styles.controls}>
        <View style={styles.row}>
          <Button title="Open" onPress={() => void pick()} />
          {doc && (
            <Button
              title={playback.playing ? 'Pause' : 'Play'}
              disabled={playback.loadingVoice}
              onPress={() =>
                playback.playing ? playback.pause() : void playback.play(playback.currentIndex)
              }
            />
          )}
          {doc && skipTo !== null && !playback.playing && (
            <Button title="Skip to chapter 1" onPress={() => void playback.jumpTo(skipTo)} />
          )}
        </View>

        {doc && (
          <View style={styles.row}>
            <Button title="−" onPress={() => playback.setRate(playback.rate - RATE_RANGE.step)} />
            <Text style={styles.rate}>{playback.rate.toFixed(1)}×</Text>
            <Button title="+" onPress={() => playback.setRate(playback.rate + RATE_RANGE.step)} />
            <Text style={styles.meta}>
              {doc ? `${playback.currentIndex + 1} / ${sentences.length}` : ''}
            </Text>
          </View>
        )}

        {doc && message !== status && <Text style={styles.status}>{message}</Text>}
      </View>

      {uri && (
        <ExtractorWebView
          uri={uri}
          onProgress={(page, total) => setStatus(`Extracting page ${page} of ${total}...`)}
          onDone={(extracted) => {
            setUri(null);
            setDoc(extracted);
            setSkipTo(findMainContentStart(extracted.sentences));
            setStatus(`${extracted.sentences.length} sentences.`);
          }}
          onError={(message) => {
            setUri(null);
            setStatus(`Extraction failed: ${message}`);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  controls: { borderTopWidth: 1, borderTopColor: '#e2e2e2', padding: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  status: { fontSize: 13, color: '#444' },
  meta: { fontSize: 13, color: '#777', marginLeft: 'auto' },
  rate: { fontSize: 15, fontVariant: ['tabular-nums'], minWidth: 44, textAlign: 'center' },
});
