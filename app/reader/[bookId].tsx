import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { getBook, readSentences, touchBook, type Book } from '../../src/db/books';
import { findMainContentStart } from '../../src/extraction/mainContent';
import type { Sentence } from '../../src/extraction/types';
import { usePlayback } from '../../src/player/usePlayback';
import { useSavedPosition } from '../../src/player/useSavedPosition';
import { estimateSeconds, wordDuration } from '../../src/player/listeningTime';
import { nextRate } from '../../src/player/rate';
import { SentenceList } from '../../src/ui/SentenceList';
import { Player } from '../../src/ui/Player';
import { VoicePicker } from '../../src/ui/VoicePicker';
import { useFontSize, useTheme } from '../../src/ui/ThemeProvider';
import { useAutoHide } from '../../src/ui/useAutoHide';

const NO_SENTENCES: Sentence[] = [];

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
  const { colors, space, font } = useTheme();
  const { fontSize } = useFontSize();
  const playback = usePlayback(sentences, book.title, book.position);
  useSavedPosition(book.id, playback.currentIndex);

  const [skipTo] = useState(() => findMainContentStart(sentences));
  const [choosingVoice, setChoosingVoice] = useState(false);
  const chrome = useAutoHide(playback.playing);

  const at = playback.currentIndex;

  // Recomputed only when the place or the speed changes, not on every render:
  // this walks the whole book, which for a 5,000-sentence one is real work.
  const { elapsed, remaining } = useMemo(
    () => ({
      elapsed: wordDuration(estimateSeconds(sentences.slice(0, at), playback.rate)) || '0m',
      remaining: `${wordDuration(estimateSeconds(sentences.slice(at), playback.rate)) || '0m'} left`,
    }),
    [sentences, at, playback.rate],
  );

  const currentVoice = playback.voices.find((voice) => voice.id === playback.voiceId);

  const message =
    playback.error ??
    (playback.loadingVoice ? 'Loading the voice…' : playback.buffering ? 'Synthesising…' : null);

  const leave = () => {
    // Leaving stops the voice: a book read from the library screen would have
    // no text to follow and no way to be paused.
    playback.pause();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <Animated.View
        pointerEvents={chrome.visible ? 'auto' : 'none'}
        style={[
          styles.header,
          { opacity: chrome.opacity, paddingHorizontal: space.md, paddingTop: space.xxxl },
        ]}
      >
        <Pressable
          onPress={leave}
          accessibilityRole="button"
          accessibilityLabel="Back to library"
          hitSlop={10}
          style={styles.headerButton}
        >
          <Ionicons name="chevron-down" size={26} color={colors.text} />
        </Pressable>
        <Text
          numberOfLines={1}
          style={[styles.headerTitle, { color: colors.textMuted, fontSize: font.sm }]}
        >
          {book.title}
        </Text>
        {skipTo !== null && at < skipTo && !playback.playing ? (
          <Pressable
            onPress={() => void playback.jumpTo(skipTo)}
            accessibilityRole="button"
            accessibilityLabel="Skip the front matter"
            hitSlop={10}
            style={styles.headerButton}
          >
            <Ionicons name="return-down-forward" size={22} color={colors.accent} />
          </Pressable>
        ) : (
          <View style={styles.headerButton} />
        )}
      </Animated.View>

      {/*
        The page surface. Everything below it -- the player, the header, the
        saved position -- talks to `playback` rather than to this, so rendering
        the real PDF page here later replaces one component rather than the
        screen.
      */}
      <Pressable style={styles.page} onPress={chrome.reveal}>
        <SentenceList
          sentences={sentences}
          currentIndex={at}
          onJump={(index) => void playback.jumpTo(index)}
          fontSize={fontSize}
          following={playback.playing}
        />
      </Pressable>

      {message && (
        <Text
          style={[
            styles.message,
            { color: colors.textMuted, fontSize: font.sm, paddingHorizontal: space.xl },
          ]}
        >
          {message}
        </Text>
      )}

      <Animated.View
        // Controls that cannot be seen must not still be pressable.
        pointerEvents={chrome.visible ? 'auto' : 'none'}
        style={{ opacity: chrome.opacity }}
      >
        <Player
          playing={playback.playing}
          busy={playback.loadingVoice}
          position={at}
          total={sentences.length}
          elapsed={elapsed}
          remaining={remaining}
          voiceName={currentVoice?.label ?? 'Voice'}
          rate={playback.rate}
          onPlayPause={() =>
            playback.playing ? playback.pause() : void playback.play(at)
          }
          onPrevious={() => void playback.jumpTo(Math.max(0, at - 1))}
          onNext={() => void playback.jumpTo(Math.min(sentences.length - 1, at + 1))}
          onPickVoice={() => setChoosingVoice(true)}
          onCycleRate={() => playback.setRate(nextRate(playback.rate))}
        />
      </Animated.View>

      <VoicePicker
        visible={choosingVoice}
        voices={playback.voices}
        chosenId={playback.voiceId}
        onClose={() => setChoosingVoice(false)}
        onChoose={(id) => {
          setChoosingVoice(false);
          // Changing voice re-reads from here in the new voice; what was
          // already made was spoken by the old one.
          void playback.selectVoice(id);
        }}
      />
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.centered}>
      {typeof children === 'string' ? <Text>{children}</Text> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontWeight: '600' },
  message: { paddingBottom: 6 },
});
