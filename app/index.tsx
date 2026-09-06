import { useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ExtractorWebView } from '../src/extraction/ExtractorWebView';
import { findMainContentStart } from '../src/extraction/mainContent';
import type { ExtractedDoc, Sentence } from '../src/extraction/types';
import { usePlayback } from '../src/player/usePlayback';

/**
 * A stable empty list. A fresh `[]` on every render would rebuild the synthesis
 * queue each time, tearing down the loaded voice along with it.
 */
const NO_SENTENCES: Sentence[] = [];

/**
 * Temporary harness for testing extraction and reading aloud on a device. The
 * real library and reader screens replace it once the pipeline is trusted.
 */
export default function Library() {
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

  const current = sentences[playback.currentIndex];
  const around = sentences.slice(
    Math.max(0, playback.currentIndex - 2),
    playback.currentIndex + 8,
  );

  return (
    <View style={styles.screen}>
      <Button title="Pick a PDF" onPress={() => void pick()} />

      {doc && (
        <View style={styles.row}>
          <Button
            title={playback.playing ? 'Pause' : 'Read from the start'}
            disabled={playback.loadingVoice}
            onPress={() => (playback.playing ? playback.pause() : void playback.play(0))}
          />
          {skipTo !== null && !playback.playing && (
            <Button title="Skip front matter" onPress={() => void playback.jumpTo(skipTo)} />
          )}
        </View>
      )}

      <Text style={styles.status}>
        {playback.error ??
          (playback.loadingVoice
            ? 'Loading the voice...'
            : playback.buffering
              ? 'Synthesising...'
              : status)}
      </Text>

      {doc && (
        <Text style={styles.meta}>
          sentence {playback.currentIndex + 1} of {sentences.length}
          {current ? ` · ${current.kind}` : ''}
        </Text>
      )}

      <ScrollView style={styles.output}>
        {around.map((sentence) => (
          <Text
            key={sentence.index}
            style={[styles.sentence, sentence.index === playback.currentIndex && styles.speaking]}
            onPress={() => void playback.jumpTo(sentence.index)}
          >
            {sentence.text}
          </Text>
        ))}
      </ScrollView>

      {uri && (
        <ExtractorWebView
          uri={uri}
          onProgress={(page, total) => setStatus(`Extracting page ${page} of ${total}...`)}
          onDone={(extracted) => {
            setUri(null);
            setDoc(extracted);
            setSkipTo(findMainContentStart(extracted.sentences));
            setStatus(`Extracted ${extracted.sentences.length} sentences.`);
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
  screen: { flex: 1, padding: 16, gap: 8 },
  row: { flexDirection: 'row', gap: 12 },
  status: { fontSize: 14, fontWeight: '600' },
  meta: { fontSize: 12, color: '#555' },
  output: { flex: 1 },
  sentence: { fontSize: 16, lineHeight: 24, marginBottom: 10, color: '#333' },
  speaking: { backgroundColor: '#ffe9a8', color: '#000' },
});
