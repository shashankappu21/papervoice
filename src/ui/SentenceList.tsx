import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Sentence } from '../extraction/types';

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
  const list = useRef<FlatList<Sentence>>(null);
  const lastTap = useRef<{ index: number; at: number }>({ index: -1, at: 0 });
  const [autoScroll, setAutoScroll] = useState(true);
  const opened = useRef(false);
  const wasFollowing = useRef(following);

  // Opening a book puts the reader back where they stopped. The audio already
  // resumes there; without this the page did not, so a reader returning to a
  // long book had to go looking for their own place.
  useEffect(() => {
    if (opened.current || sentences.length === 0) return;
    opened.current = true;
    if (currentIndex === 0) return;
    list.current?.scrollToIndex({
      index: currentIndex,
      viewPosition: VIEW_POSITION,
      // No animation: this is where the book opens, not somewhere it travels to.
      animated: false,
    });
  }, [sentences.length, currentIndex]);

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
    list.current?.scrollToIndex({
      index: currentIndex,
      viewPosition: VIEW_POSITION,
      animated: true,
    });
  }, [currentIndex, autoScroll, following]);

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
      onScrollToIndexFailed={({ index, averageItemLength }) => {
        // The row has not been measured yet. Get close, then ask again.
        list.current?.scrollToOffset({ offset: index * averageItemLength, animated: false });
        setTimeout(
          () => list.current?.scrollToIndex({ index, viewPosition: VIEW_POSITION }),
          50,
        );
      }}
      renderItem={({ item }) => (
        <Pressable onPress={() => handlePress(item.index)}>
          <View style={item.index === currentIndex ? styles.speaking : undefined}>
            <Text
              style={[
                styles.sentence,
                { fontSize, lineHeight: fontSize * 1.6 },
                item.kind === 'heading' && styles.heading,
                item.kind === 'note' && styles.note,
                // Headers and footers are on the page but never spoken, and are
                // shown faintly so the page still reads as the page.
                (item.kind === 'header' || item.kind === 'footer') && styles.furniture,
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
  sentence: { paddingHorizontal: 20, paddingVertical: 2, color: '#222' },
  speaking: { backgroundColor: '#ffe9a8' },
  heading: { fontWeight: '700' },
  note: { color: '#666' },
  furniture: { color: '#aaa', fontStyle: 'italic' },
});
