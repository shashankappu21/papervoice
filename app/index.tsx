import { useRef, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, Paths } from 'expo-file-system';
import { useAudioPlaylist } from 'expo-audio';
import { ExtractorWebView } from '../src/extraction/ExtractorWebView';
import type { ExtractedDoc, Sentence } from '../src/extraction/types';
import { SherpaTts } from '../modules/sherpa-tts';
import { LJSPEECH, voicePaths } from '../src/tts/modelPaths';
import { findMainContentStart } from '../src/extraction/mainContent';
import { speakable } from '../src/tts/speakable';
import { chunk } from '../src/tts/chunk';
import { pauseAfter } from '../src/tts/pauses';

/** How long an utterance may be before it is cut into separate synthesis jobs. */
const CHUNK_LIMIT = 300;

/** Sentences to read in this test harness, so a run finishes in a few seconds. */
const PREVIEW = 6;

/**
 * Temporary harness for testing extraction and speech on a device. The real
 * library and reader screens replace it once the pipeline is trusted.
 */
export default function Library() {
  const [uri, setUri] = useState<string | null>(null);
  const [status, setStatus] = useState('Pick a PDF, or speak the test sentence.');
  const [log, setLog] = useState<string[]>([]);
  const [doc, setDoc] = useState<ExtractedDoc | null>(null);
  // Where the book's own content starts, when there is front matter to skip.
  // Null means there is nothing to skip, and no button for it.
  const [skipTo, setSkipTo] = useState<number | null>(null);
  const loaded = useRef(false);
  const run = useRef(0);
  // What the device actually managed on the last utterance, which decides
  // whether there is room to spend on a pause after the next one.
  const recentRtf = useRef<number | undefined>(undefined);
  const playlist = useAudioPlaylist();

  const say = (line: string) => {
    console.log(`[papervoice] ${line}`);
    setLog((lines) => [...lines, line]);
  };

  /** Loads the voice once per app run; it takes a moment and holds memory. */
  const ensureVoice = async () => {
    if (loaded.current) return;
    const paths = voicePaths(LJSPEECH.id, LJSPEECH.file);
    const started = Date.now();
    const info = await SherpaTts.load(paths.model, paths.tokens, paths.dataDir, 2);
    loaded.current = true;
    say(`voice loaded in ${Date.now() - started}ms: ${info.sampleRate}Hz, ${info.numSpeakers} speaker(s)`);
  };

  /**
   * Starts a run: empties the playlist and takes a fresh run number.
   *
   * Without the clear, a second run appends behind a track that has already
   * finished, so play() resumes at the end of it and nothing is heard.
   */
  const startRun = () => {
    playlist.clear();
    setLog([]);
    // Each run measures the device afresh rather than trusting the last one.
    recentRtf.current = undefined;
    run.current += 1;
    return run.current;
  };

  /** Synthesises one sentence, adding each piece to the playlist as it lands. */
  const speak = async (sentence: Sentence, order: number, runId: number) => {
    const cache = new Directory(Paths.cache, 'utterances');
    if (!cache.exists) cache.create({ intermediates: true });

    const pieces = chunk(speakable(sentence.text), CHUNK_LIMIT);
    for (const [n, piece] of pieces.entries()) {
      const silenceMs = pauseAfter({
        kind: sentence.kind,
        endsSentence: n === pieces.length - 1,
        rtf: recentRtf.current,
      });
      // A fresh name per run: overwriting a file the player still holds open
      // leaves it playing the copy it already decoded.
      const name = `${runId}-${order}-${n}.wav`;
      const out = `${Paths.cache.uri.replace(/^file:\/\//, '')}utterances/${name}`;
      const result = await SherpaTts.synthesize(piece, 0, 1.0, out, silenceMs);
      recentRtf.current = result.rtf;
      say(
        `#${order}.${n} rtf ${result.rtf.toFixed(3)} for ${result.durationSec.toFixed(1)}s` +
          (silenceMs > 0 ? ` +${silenceMs}ms` : ' no pause'),
      );
      // The type allows a bare string, but the native side only accepts the
      // object form and rejects a string at the bridge.
      playlist.add({ uri: `file://${result.path}` });
    }
  };

  const speakTestSentence = async () => {
    try {
      const runId = startRun();
      setStatus('Loading the voice...');
      await ensureVoice();
      setStatus('Synthesising...');
      await speak(
        {
          index: 0,
          kind: 'body',
          text: 'The count had not yet spoken, and the room was very still.',
          boxes: [],
        },
        0,
        runId,
      );
      playlist.skipTo(0);
      playlist.play();
      setStatus(`Playing (${playlist.trackCount} track(s)).`);
    } catch (error) {
      setStatus(`Failed: ${String(error)}`);
      say(String(error));
    }
  };

  const readDocument = async (from: number) => {
    if (!doc) return;
    try {
      const runId = startRun();
      setStatus('Loading the voice...');
      await ensureVoice();

      const spoken = doc.sentences
        .slice(from)
        .filter((s) => s.kind !== 'header' && s.kind !== 'footer')
        .slice(0, PREVIEW);

      setStatus(`Synthesising ${spoken.length} sentences...`);
      for (const [order, sentence] of spoken.entries()) {
        await speak(sentence, order, runId);
        // Start speaking as soon as there is something to say, rather than
        // waiting for the whole preview to be synthesised.
        if (order === 0) {
          playlist.skipTo(0);
          playlist.play();
        }
      }
      setStatus('Playing.');
    } catch (error) {
      setStatus(`Failed: ${String(error)}`);
      say(String(error));
    }
  };

  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    setDoc(null);
    setSkipTo(null);
    setLog([]);
    setStatus('Extracting...');
    setUri(result.assets[0].uri);
  };

  return (
    <View style={styles.screen}>
      <Button title="Speak a test sentence" onPress={() => void speakTestSentence()} />
      <Button title="Pick a PDF" onPress={() => void pick()} />
      {doc && (
        <Button
          title={`Read the first ${PREVIEW} sentences`}
          onPress={() => void readDocument(0)}
        />
      )}
      {doc && skipTo !== null && (
        <Button
          title={`Skip front matter (start at "${doc.sentences[skipTo].text.slice(0, 24)}")`}
          onPress={() => void readDocument(skipTo)}
        />
      )}
      <Button title="Stop" onPress={() => playlist.pause()} />

      <Text style={styles.status}>{status}</Text>
      {doc && (
        <Text style={styles.meta}>
          {doc.sentences.length} sentences over {doc.pageCount} pages
        </Text>
      )}

      <ScrollView style={styles.output}>
        {log.map((line, i) => (
          <Text key={i} style={styles.line}>
            {line}
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
  status: { fontSize: 14, fontWeight: '600' },
  meta: { fontSize: 13 },
  output: { flex: 1 },
  line: { fontSize: 12, fontFamily: 'monospace' },
});
