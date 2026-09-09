import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { getBook, readSentences, touchBook, type Book } from '../../src/db/books';
import { findMainContentStart } from '../../src/extraction/mainContent';
import type { Sentence } from '../../src/extraction/types';
import { usePlayback, RATE_RANGE } from '../../src/player/usePlayback';
import { useSavedPosition } from '../../src/player/useSavedPosition';
import { SentenceList } from '../../src/ui/SentenceList';
import { IconButton } from '../../src/ui/IconButton';
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
  const { colors, space, font, radius } = useTheme();
  const { fontSize } = useFontSize();
  const playback = usePlayback(sentences, book.title, book.position);
  useSavedPosition(book.id, playback.currentIndex);

  const [skipTo] = useState(() => findMainContentStart(sentences));
  const [choosingVoice, setChoosingVoice] = useState(false);
  const chrome = useAutoHide(playback.playing);

  const currentVoice = playback.voices.find((voice) => voice.id === playback.voiceId);

  const message =
    playback.error ??
    (playback.loadingVoice ? 'Loading the voice...' : playback.buffering ? 'Synthesising...' : null);

  const leave = () => {
    // Leaving stops the voice: a book read from the library screen would have
    // no text to follow and no way to be paused.
    playback.pause();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ title: book.title }} />

      {/* A tap anywhere on the page brings the controls back. */}
      <Pressable style={styles.page} onPress={chrome.reveal}>
        <SentenceList
          sentences={sentences}
          currentIndex={playback.currentIndex}
          onJump={(index) => void playback.jumpTo(index)}
          fontSize={fontSize}
          following={playback.playing}
        />
      </Pressable>

      <Animated.View
        // Controls that cannot be seen must not still be pressable.
        pointerEvents={chrome.visible ? 'auto' : 'none'}
        style={[
          styles.controls,
          {
            opacity: chrome.opacity,
            borderTopColor: colors.divider,
            backgroundColor: colors.bg,
            padding: space.md,
            gap: space.sm,
          },
        ]}
      >
        <View style={styles.row}>
          <IconButton name="chevron-back" label="Back to library" onPress={leave} />
          <IconButton
            name={playback.playing ? 'pause' : 'play'}
            label={playback.playing ? 'Pause' : 'Play'}
            size={30}
            color={colors.accent}
            disabled={playback.loadingVoice}
            onPress={() =>
              playback.playing ? playback.pause() : void playback.play(playback.currentIndex)
            }
          />
          {skipTo !== null && playback.currentIndex < skipTo && !playback.playing && (
            <IconButton
              name="play-skip-forward"
              label="Skip to chapter one"
              onPress={() => void playback.jumpTo(skipTo)}
            />
          )}
          <Text style={[styles.meta, { color: colors.textMuted, fontSize: font.sm }]}>
            {playback.currentIndex + 1} / {sentences.length}
          </Text>
        </View>

        <View style={styles.row}>
          <IconButton
            name="remove"
            label="Read slower"
            size={20}
            onPress={() => playback.setRate(playback.rate - RATE_RANGE.step)}
          />
          <Text style={[styles.rate, { color: colors.text, fontSize: font.md }]}>
            {playback.rate.toFixed(1)}×
          </Text>
          <IconButton
            name="add"
            label="Read faster"
            size={20}
            onPress={() => playback.setRate(playback.rate + RATE_RANGE.step)}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Voice: ${currentVoice?.label ?? 'none chosen'}`}
            style={[
              styles.voicePicker,
              { borderColor: colors.border, borderRadius: radius.sm },
            ]}
            onPress={() => setChoosingVoice(true)}
          >
            <Text
              style={{ color: colors.text, fontSize: font.sm }}
              numberOfLines={1}
            >
              {currentVoice?.label ?? (playback.loadingVoice ? 'Loading…' : 'Voice')}
              {playback.rtf !== null ? ` · ${playback.rtf.toFixed(2)}×` : ''}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Its own row: squeezed beside the controls, a message long enough to
            explain anything was cut off mid-word. */}
        {message && (
          <Text style={{ color: colors.text, fontSize: font.sm, lineHeight: 18 }}>{message}</Text>
        )}
      </Animated.View>

      <Modal
        visible={choosingVoice}
        transparent
        animationType="fade"
        onRequestClose={() => setChoosingVoice(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setChoosingVoice(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.bg }]}
            onPress={() => undefined}
          >
            <Text style={[styles.sheetTitle, { color: colors.textMuted, fontSize: font.sm }]}>
              READ WITH
            </Text>
            <ScrollView>
              {playback.voices.map((voice) => {
                const chosen = voice.id === playback.voiceId;
                return (
                  <Pressable
                    key={voice.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: chosen }}
                    style={[styles.option, chosen && { backgroundColor: colors.surface }]}
                    onPress={() => {
                      setChoosingVoice(false);
                      // Changing voice re-reads from here in the new voice; what
                      // was already made was spoken by the old one.
                      void playback.selectVoice(voice.id);
                    }}
                  >
                    <View style={styles.optionRow}>
                      {/* A tick rather than colour alone, which is invisible to
                          a reader who cannot distinguish it. */}
                      <View style={styles.tick}>
                        {chosen && (
                          <Ionicons name="checkmark" size={18} color={colors.accent} />
                        )}
                      </View>
                      <View style={styles.optionText}>
                        <Text
                          style={{
                            color: chosen ? colors.accent : colors.text,
                            fontSize: font.lg,
                            fontWeight: chosen ? '700' : '400',
                          }}
                        >
                          {voice.label}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: font.xs, marginTop: 2 }}>
                          {voice.detail}
                          {chosen ? ' · reading now' : ''}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
              {playback.voices.length === 0 && (
                <Text
                  style={{ color: colors.textMuted, fontSize: font.sm, padding: space.lg }}
                >
                  No voice is available yet. Download one from the Voices tab.
                </Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
  controls: { borderTopWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { marginLeft: 'auto', fontVariant: ['tabular-nums'] },
  rate: { fontVariant: ['tabular-nums'], minWidth: 44, textAlign: 'center' },
  voicePicker: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    maxWidth: 190,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingVertical: 12, maxHeight: '60%' },
  sheetTitle: {
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  option: { paddingHorizontal: 16, paddingVertical: 12 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionText: { flex: 1 },
  tick: { width: 18, alignItems: 'center' },
});
