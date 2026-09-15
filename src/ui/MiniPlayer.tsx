import { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from './ThemeProvider';
import { BookCover } from './BookCover';
import { Spinner } from './Spinner';
import { useReading } from '../player/PlaybackProvider';
import { secondsBetween, spokenLengths, wordDuration } from '../player/listeningTime';

/**
 * The book being read, kept in reach of every screen.
 *
 * It sits directly above the tab bar and only exists while a book is open.
 * Tapping it opens the reader; the play button works without leaving wherever
 * you are, which is the whole point of having it.
 */
export function MiniPlayer() {
  const router = useRouter();
  const { colors, space, radius, font } = useTheme();
  const { playback, book, sentences } = useReading();

  const showing = book !== null;
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(rise, {
      toValue: showing ? 1 : 0,
      useNativeDriver: true,
      speed: 14,
      bounciness: 4,
    }).start();
  }, [showing, rise]);

  /*
   * Above the early return, because hooks must be, and memoised because this
   * used to be neither. It walked the entire book on every render of the bar --
   * which redraws on each spoken sentence, each press, and each animation of
   * the thing rising into view.
   */
  const running = useMemo(() => spokenLengths(sentences), [sentences]);

  if (!book) return null;

  const left =
    wordDuration(
      secondsBetween(running, playback.currentIndex, sentences.length, playback.rate),
    ) || '';
  const fraction =
    sentences.length > 0 ? (playback.currentIndex + 1) / sentences.length : 0;

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          marginHorizontal: space.sm,
          marginBottom: space.xs,
          opacity: rise,
          transform: [
            { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [70, 0] }) },
          ],
        },
      ]}
    >
      <Pressable
        onPress={() =>
          router.push({ pathname: '/reader/[bookId]', params: { bookId: book.id } })
        }
        accessibilityRole="button"
        accessibilityLabel={`${book.title}, ${left} left. Open the reader.`}
        style={({ pressed }) => [
          styles.row,
          { padding: space.sm, gap: space.md, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <BookCover title={book.title} uri={book.coverPath} width={40} height={40} />

        <View style={styles.text}>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: font.md, fontWeight: '600' }}>
            {book.title}
          </Text>
          <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: font.xs, marginTop: 1 }}>
            {left ? `${left} remaining` : 'Ready'}
          </Text>
        </View>

        <Pressable
          onPress={() =>
            playback.playing
              ? playback.pause()
              : void playback.play(playback.currentIndex)
          }
          disabled={playback.loadingVoice}
          accessibilityRole="button"
          accessibilityLabel={playback.playing ? 'Pause' : 'Play'}
          hitSlop={10}
          style={({ pressed }) => [
            styles.play,
            {
              backgroundColor: colors.accent,
              opacity: playback.loadingVoice ? 0.5 : pressed ? 0.7 : 1,
            },
          ]}
        >
          {(playback.loadingVoice || playback.buffering) && (
            <View style={styles.ring}>
              <Spinner size={48} color={colors.accent} width={2} />
            </View>
          )}
          <Ionicons
            name={playback.playing ? 'pause' : 'play'}
            size={20}
            color={colors.accentOn}
            style={playback.playing ? undefined : { marginLeft: 2 }}
          />
        </Pressable>
      </Pressable>

      <View style={[styles.track, { backgroundColor: colors.divider }]}>
        <View
          style={[
            styles.fill,
            { width: `${Math.max(1, fraction * 100)}%`, backgroundColor: colors.accent },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1 },
  play: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute' },
  track: { height: 2 },
  fill: { height: 2 },
});
