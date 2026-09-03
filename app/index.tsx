import { useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ExtractorWebView } from '../src/extraction/ExtractorWebView';
import type { ExtractedDoc } from '../src/extraction/types';

/**
 * Temporary harness for verifying extraction on a device. The real library
 * screen replaces this in Task 8.
 */
export default function Library() {
  const [uri, setUri] = useState<string | null>(null);
  const [status, setStatus] = useState('Pick a PDF to extract.');
  const [doc, setDoc] = useState<ExtractedDoc | null>(null);

  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    setDoc(null);
    setStatus('Extracting...');
    setUri(result.assets[0].uri);
  };

  return (
    <View style={styles.screen}>
      <Button title="Pick a PDF" onPress={() => void pick()} />
      <Text style={styles.status}>{status}</Text>

      {doc && (
        <ScrollView style={styles.output}>
          <Text style={styles.meta}>
            {doc.sentences.length} sentences over {doc.pageCount} pages
          </Text>
          {doc.sentences.slice(0, 5).map((sentence) => (
            <Text key={sentence.index} style={styles.sentence}>
              [{sentence.index}] {sentence.text}
            </Text>
          ))}
        </ScrollView>
      )}

      {uri && (
        <ExtractorWebView
          uri={uri}
          onProgress={(page, total) => setStatus(`Extracting page ${page} of ${total}...`)}
          onDone={(extracted) => {
            setUri(null);
            setDoc(extracted);
            setStatus(`Done: ${extracted.sentences.length} sentences.`);
            console.log(`[extract] ${extracted.sentences.length} sentences`);
            extracted.sentences.slice(0, 5).forEach((s) => console.log(`[extract] ${s.index}: ${s.text}`));
          }}
          onError={(message) => {
            setUri(null);
            setStatus(`Failed: ${message}`);
            console.log(`[extract] error: ${message}`);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 12 },
  status: { fontSize: 14 },
  meta: { fontWeight: '600', marginBottom: 8 },
  output: { flex: 1 },
  sentence: { fontSize: 13, marginBottom: 8 },
});
