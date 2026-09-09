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
import { createHeightIndex } from './heightIndex';

interface Props {
  sentences: Sentence[];
  /** The sentence being spoken, which is the one tinted. */
  currentIndex: number;
  onJump: (index: number) => void;
  fontSize: number;
  /** True while reading: autoscroll only follows a voice that is speaking. */
  following: boolean;
  /**
   * A request to bring the spoken sentence into view and say when it is there.
   * Distinct from following: this is a jump, not the page keeping pace.
   */
  locating?: boolean;
  /** Fired when the spoken sentence is actually on screen, not merely aimed at. */
  onLocated?: () => void;
}

/** Two taps closer together than this are one gesture. */
const DOUBLE_TAP_MS = 300;

/** Where on the screen the spoken sentence sits. */
const VIEW_POSITION = 0.5;

/**
 * How many times to re-aim before giving up.
 *
 * Row heights are estimated, so the first jump lands near rather than on the
 * target. Each attempt renders the rows around where it landed, which corrects
 * the estimates nearby, so the next one lands closer. Three is enough for a
 * five-thousand-sentence book; more would be chasing rounding.
 */
const ATTEMPTS = 3;

/** Long enough for a jump to render before it is judged to have missed. */
const SETTLE_MS = 140;

/**
 * A row counts as seen once any of it is showing.
 *
 * Zero rather than a percentage: this decides whether a jump arrived, and a
 * sentence half off the bottom has still arrived.
 */
const VIEWABILITY = { itemVisiblePercentThreshold: 0, minimumViewTime: 0 };

/**
 * The document, reflowed as sentences, with the spoken one tinted.
 *
 * Autoscroll follows the voice but yields to the reader: someone who scrolls
 * away is looking for something, and dragging them back mid-search is the most
 * irritating thing a reading app can do. Following resumes when they double-tap
 * a sentence, which says where they want to be.
 */
export function SentenceList({
  sentences,
  currentIndex,
  onJump,
  fontSize,
  following,
  locating = false,
  onLocated,
}: Props) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const list = useRef<FlatList<Sentence>>(null);
  const lastTap = useRef<{ index: number; at: number }>({ index: -1, at: 0 });
  const [autoScroll, setAutoScroll] = useState(true);

  /*
   * Where every row is.
   *
   * Rebuilt only when the book or the type size changes; each row feeds it its
   * true height as it is laid out, so the list stops guessing about anywhere
   * the reader has been.
   */
  const heights = useMemo(
    () => createHeightIndex(sentences, fontSize, width),
    [sentences, fontSize, width],
  );

  const opened = useRef(false);
  const wasFollowing = useRef(following);

  /** Where the book opens. Captured once: FlatList reads it only at mount. */
  const opensAt = useRef(currentIndex);

  /** What is on screen right now, so a jump can tell whether it arrived. */
  const visible = useRef<{ first: number; last: number }>({
    first: currentIndex,
    last: currentIndex,
  });

  /*
   * Held in a ref because FlatList refuses a changing onViewableItemsChanged,
   * and this one only ever writes to a ref.
   */
  const onViewable = useRef(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    const indices = viewableItems
      .map((item) => item.index)
      .filter((index): index is number => index !== null);
    if (indices.length === 0) return;
    visible.current = { first: Math.min(...indices), last: Math.max(...indices) };
  });
  const chasing = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * The caller rebuilds this on every render -- it closes over playback, which
   * changes with every sentence -- and depending on it directly restarted the
   * scroll each time, which is most of what was seen as the page moving on its
   * own. Held in a ref so the chase below can have no dependencies at all.
   */
  const located = useRef(onLocated);
  located.current = onLocated;

  /**
   * Keeps the spoken line where it belongs while reading.
   *
   * Always moves, even when the sentence is already somewhere on screen.
   * Stopping early because it was technically visible is what made the
   * highlight sink to the bottom of the page and then jump: following means
   * holding the line in the same place, not merely keeping it in the window.
   *
   * No verification here. Consecutive sentences have been rendered and so are
   * measured, which makes this exact.
   */
  const follow = useCallback((index: number) => {
    try {
      list.current?.scrollToIndex({ index, viewPosition: VIEW_POSITION, animated: true });
    } catch {
      // Not measured yet. The next sentence will carry the page along.
    }
  }, []);

  /**
   * Goes to a sentence somewhere else, and checks that it arrived.
   *
   * For a jump the target has never been rendered, so its height is estimated
   * and the first move lands near rather than on it. Re-aiming works because
   * the attempt that missed rendered the rows around where it landed, which is
   * what makes the next estimate better.
   */
  const chase = useCallback((index: number, animated: boolean) => {
    if (chasing.current) clearTimeout(chasing.current);

    let left = ATTEMPTS;

    const attempt = () => {
      const { first, last } = visible.current;
      if (index >= first && index <= last) {
        located.current?.();
        return;
      }

      try {
        list.current?.scrollToIndex({
          index,
          viewPosition: VIEW_POSITION,
          // Only the first move is animated. An animated correction is a
          // second journey the reader can see, and two overlapping is what
          // hunting looks like.
          animated: animated && left === ATTEMPTS,
        });
      } catch {
        // The list has not measured itself yet. The retry below is the fix.
      }

      left -= 1;
      if (left > 0) {
        chasing.current = setTimeout(attempt, SETTLE_MS);
      } else {
        // Out of attempts. Say it is located rather than leaving the reader
        // waiting on a sentence that is a few pixels off.
        located.current?.();
      }
    };

    attempt();
    return () => {
      if (chasing.current) clearTimeout(chasing.current);
    };
  }, []);

  // Asked to find the line before the voice starts.
  useEffect(() => {
    if (!locating) return;
    setAutoScroll(true);
    return chase(currentIndex, false);
  }, [locating, currentIndex, chase]);

  // Opening a book puts the reader back where they stopped. The audio already
  // resumes there; without this the page did not, so a reader returning to a
  // long book had to go looking for their own place.
  useEffect(() => {
    if (opened.current || sentences.length === 0) return;
    opened.current = true;
    if (currentIndex === 0) return;
    // No animation: this is where the book opens, not somewhere it travels to.
    return chase(currentIndex, false);
  }, [sentences.length, currentIndex, chase]);

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
    follow(currentIndex);
  }, [currentIndex, autoScroll, following, follow]);

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
      // Opens directly at the saved place instead of scrolling there after
      // mounting, which is the difference between arriving and travelling.
      initialScrollIndex={opensAt.current}
      /*
       * Rows are measured as they render, which changes the offsets of
       * everything below them. Without this, correcting a height shifts the
       * page under the reader -- and the chase then re-aims at a line that
       * has moved, which is what made it hunt up and down.
       */
      maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
      viewabilityConfig={VIEWABILITY}
      onViewableItemsChanged={onViewable.current}
      getItemLayout={(_data, index) => ({
        length: heights.heightOf(index),
        offset: heights.offsetOf(index),
        index,
      })}
      onScrollToIndexFailed={({ index }) => {
        list.current?.scrollToOffset({ offset: heights.offsetOf(index), animated: false });
      }}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => handlePress(item.index)}
          // Every row reports its real height. This is what turns the list
          // from something that aims at a sentence into something that knows
          // where the sentence is.
          onLayout={(event) => heights.set(item.index, event.nativeEvent.layout.height)}
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
