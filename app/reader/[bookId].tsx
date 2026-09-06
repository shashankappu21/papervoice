import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { getBook, readSentences, touchBook, type Book } from '../../src/db/books';
import { findMainContentStart } from '../../src/extraction/mainContent';
import type { Sentence } from '../../src/extraction/types';
import { usePlayback, RATE_RANGE } from '../../src/player/usePlayback';
import { useSavedPosition } from '../../src/player/useSavedPosition';
import { SentenceList } from '../../src/ui/SentenceList';

const NO_SENTENCES: Sentence[] = [];
const FONT_SIZE = 18;

export default function ReaderScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const id = Number(bookId);

  const [book, setBook] = useState<Book | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>(NO_SENTENCES);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBook(id).then(
      (found) => {
        if (cancelled) return;
        if (!found) {
          setFailed('That book is no longer in the library.');
          return;
        }
        setSentences(readSentences(found));
        setBook(found);
        void touchBook(found.id);
      },
      (cause: unknown) => !cancelled && setFailed(String(cause)),
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (failed) return <Centered>{failed}</Centered>;
  if (!book) return <Centered><ActivityIndicator /></Centered>;

  return <Reader book={book} sentences={sentences} />;
}

function Reader({ book, sentences }: { book: Book; sentences: Sentence[] }) {
  const router = useRouter();
  const playback = usePlayback(sentences, book.title, book.position);
  useSavedPosition(book.id, playback.currentIndex);

  const [skipTo] = useState(() => findMainContentStart(sentences));

  const message =
    playback.error ??
    (playback.loadingVoice ? 'Loading the voice...' : playback.buffering ? 'Synthesising...' : null);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: book.title }} />

      <SentenceList
        sentences={sentences}
        currentIndex={playback.currentIndex}
        onJump={(index) => void playback.jumpTo(index)}
        fontSize={FONT_SIZE}
        following={playback.playing}
      />

      <View style={styles.controls}>
        <View style={styles.row}>
          <Button
            title="Library"
            onPress={() => {
              // Leaving stops the voice: a book read from the library screen
              // would have no text to follow and no way to be paused.
              playback.pause();
              if (router.canGoBack()) router.back();
              else router.replace('/');
            }}
          />
          <Button
            title={playback.playing ? 'Pause' : 'Play'}
            disabled={playback.loadingVoice}
            onPress={() =>
              playback.playing ? playback.pause() : void playback.play(playback.currentIndex)
            }
          />
          {skipTo !== null && playback.currentIndex < skipTo && !playback.playing && (
            <Button title="Skip to chapter 1" onPress={() => void playback.jumpTo(skipTo)} />
          )}
          <Text style={styles.meta}>
            {playback.currentIndex + 1} / {sentences.length}
          </Text>
        </View>

        <View style={styles.row}>
          <Button title="−" onPress={() => playback.setRate(playback.rate - RATE_RANGE.step)} />
          <Text style={styles.rate}>{playback.rate.toFixed(1)}×</Text>
          <Button title="+" onPress={() => playback.setRate(playback.rate + RATE_RANGE.step)} />
          {message && (
            <Text style={styles.status} numberOfLines={2}>
              {message}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{typeof children === 'string' ? <Text>{children}</Text> : children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  controls: { borderTopWidth: 1, borderTopColor: '#e2e2e2', padding: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  meta: { fontSize: 13, color: '#777', marginLeft: 'auto' },
  rate: { fontSize: 15, fontVariant: ['tabular-nums'], minWidth: 44, textAlign: 'center' },
  // flexShrink lets a long message wrap rather than run off the screen: an
  // error nobody can read is an error nobody can act on.
  status: { fontSize: 13, color: '#444', marginLeft: 'auto', flexShrink: 1, textAlign: 'right' },
});
