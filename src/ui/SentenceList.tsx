import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { Sentence } from '../extraction/types';
import { useTheme } from './ThemeProvider';
import { measureSentences } from './sentenceHeights';

interface Props {
  sentences: Sentence[];
  /** The sentence being spoken, which is the one tinted. */
  currentIndex: number;
  onJump: (index: number) => void;
  fontSize: number;
  /** True while reading: autoscroll only follows a voice that is speaking. */
  following: boolean;
}

/** Two taps closer together than this are one gesture. */
const DOUBLE_TAP_MS = 300;

/** Where on the screen the spoken sentence sits: a little above the middle. */
const VIEW_POSITION = 0.35;

/**
 * The document, reflowed as sentences, with the spoken one tinted.
 *
 * Autoscroll follows the voice but yields to the reader: someone who scrolls
 * away is looking for something, and dragging them back mid-search is the most
 * irritating thing a reading app can do. Following resumes when they double-tap
 * a sentence, which says where they want to be.
 */
export function SentenceList({ sentences, currentIndex, onJump, fontSize, following }: Props) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const list = useRef<FlatList<Sentence>>(null);
  const lastTap = useRef<{ index: number; at: number }>({ index: -1, at: 0 });
  const [autoScroll, setAutoScroll] = useState(true);

  /*
   * Where every row sits, so the list can jump straight to one.
   *
   * Without this a FlatList reaches a row by rendering every row before it,
   * which for a long book meant several seconds to open at a saved place or
   * to follow a chapter. Recomputed only when the book or the type size
   * changes, since it walks the whole document.
   */
  const layout = useMemo(
    () => measureSentences(sentences, fontSize, width),
    [sentences, fontSize, width],
  );

  /**
   * Goes to a sentence, then goes again.
   *
   * The first jump uses estimated heights and lands within a screen or so.
   * The second runs once the real rows have been laid out, and is what puts
   * the sentence exactly where it belongs.
   */
  const goTo = useCallback((index: number, animated: boolean) => {
    const scroll = () => {
      try {
        list.current?.scrollToIndex({ index, viewPosition: VIEW_POSITION, animated });
      } catch {
        // A list that has not measured itself yet rejects the request; the
        // correction below is the retry.
      }
    };
    scroll();
    const correction = setTimeout(() => scroll(), 120);
    return () => clearTimeout(correction);
  }, []);
  const opened = useRef(false);
  const wasFollowing = useRef(following);

  // Opening a book puts the reader back where they stopped. The audio already
  // resumes there; without this the page did not, so a reader returning to a
  // long book had to go looking for their own place.
  useEffect(() => {
    if (opened.current || sentences.length === 0) return;
    opened.current = true;
    if (currentIndex === 0) return;
    // No animation: this is where the book opens, not somewhere it travels to.
    return goTo(currentIndex, false);
  }, [sentences.length, currentIndex, goTo]);

  /**
   * Pressing play means "follow the voice again".
   *
   * Following used to resume only on a double-tap, so a reader who scrolled
   * back to check something earlier was never taken to the spoken line again,
   * however long they listened -- the page simply stopped moving.
   */
  useEffect(() => {
    if (following && !wasFollowing.current) setAutoScroll(true);
    wasFollowing.current = following;
  }, [following]);

  useEffect(() => {
    if (!autoScroll || !following) return;
    return goTo(currentIndex, true);
  }, [currentIndex, autoScroll, following, goTo]);

  const handlePress = (index: number) => {
    const now = Date.now();
    const isSecondTap =
      lastTap.current.index === index && now - lastTap.current.at < DOUBLE_TAP_MS;

    if (isSecondTap) {
      lastTap.current = { index: -1, at: 0 };
      // Jumping says where the reader wants to be, so following resumes.
      setAutoScroll(true);
      onJump(index);
      return;
    }
    lastTap.current = { index, at: now };
  };

  return (
    <FlatList
      ref={list}
      data={sentences}
      keyExtractor={(sentence) => String(sentence.index)}
      // A drag is the reader taking over. Momentum scrolling is not, or every
      // autoscroll would switch itself off.
      onScrollBeginDrag={() => setAutoScroll(false)}
      // Estimated, not measured: a few pixels out per row, which the second
      // pass in goTo corrects, in exchange for jumping anywhere instantly.
      getItemLayout={(_data, index) => ({
        length: layout.heights[index] ?? 0,
        offset: layout.offsets[index] ?? 0,
        index,
      })}
      onScrollToIndexFailed={({ index }) => {
        list.current?.scrollToOffset({ offset: layout.offsets[index] ?? 0, animated: false });
      }}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => handlePress(item.index)}
          accessibilityRole="button"
          accessibilityState={{ selected: item.index === currentIndex }}
        >
          <View
            style={
              item.index === currentIndex ? { backgroundColor: colors.highlight } : undefined
            }
          >
            <Text
              style={[
                styles.sentence,
                { fontSize, lineHeight: fontSize * 1.6, color: colors.text },
                item.kind === 'heading' && styles.heading,
                item.kind === 'note' && { color: colors.textMuted },
                // Headers and footers are on the page but never spoken, and are
                // shown faintly so the page still reads as the page. Muted now
                // carries real contrast, so italics is what still marks them.
                (item.kind === 'header' || item.kind === 'footer') && {
                  color: colors.textMuted,
                  fontStyle: 'italic' as const,
                },
              ]}
            >
              {item.text}
            </Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  sentence: { paddingHorizontal: 20, paddingVertical: 2 },
  heading: { fontWeight: '700' },
});
