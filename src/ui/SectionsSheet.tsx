import { useEffect, useRef } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './ThemeProvider';
import type { Section } from '../extraction/sections';

interface Props {
  visible: boolean;
  sections: Section[];
  /** Where the reader is, so the section being read can be marked. */
  currentIndex: number;
  onClose(): void;
  onJump(index: number): void;
}

/**
 * The book's contents, as somewhere to jump to.
 *
 * It opens on the section being read rather than at the top, because someone
 * four hundred pages in is far more likely to want the chapter next to them
 * than the title page.
 */
export function SectionsSheet({ visible, sections, currentIndex, onClose, onJump }: Props) {
  const { colors, space, radius, font } = useTheme();
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<Section>>(null);

  // The last section starting at or before the reader is the one they are in.
  let at = -1;
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].index <= currentIndex) at = i;
  }

  useEffect(() => {
    if (!visible || at < 0) return;
    // A frame's delay: the list has not been measured at the moment the modal
    // becomes visible, and scrolling an unmeasured list does nothing.
    const timer = setTimeout(() => {
      list.current?.scrollToIndex({ index: at, viewPosition: 0.35, animated: false });
    }, 50);
    return () => clearTimeout(timer);
  }, [visible, at]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={() => undefined}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bg,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingTop: space.md,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          <View style={[styles.grip, { backgroundColor: colors.divider }]} />
          <Text
            style={[
              styles.title,
              { color: colors.text, fontSize: font.xl, paddingHorizontal: space.xl },
            ]}
          >
            Contents
          </Text>

          <FlatList
            ref={list}
            data={sections}
            keyExtractor={(section) => String(section.index)}
            style={styles.list}
            contentContainerStyle={{ paddingBottom: space.xl }}
            onScrollToIndexFailed={({ index, averageItemLength }) => {
              list.current?.scrollToOffset({ offset: index * averageItemLength, animated: false });
            }}
            renderItem={({ item, index }) => {
              const here = index === at;
              return (
                <Pressable
                  onPress={() => {
                    onJump(item.index);
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: here }}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      // Nested entries are indented rather than labelled: the
                      // shape of a contents page is how it is read.
                      paddingLeft: space.xl + item.depth * space.lg,
                      paddingRight: space.xl,
                      paddingVertical: space.md,
                      backgroundColor: pressed ? colors.surface : 'transparent',
                    },
                  ]}
                >
                  <Text
                    numberOfLines={2}
                    style={{
                      color: here ? colors.accent : colors.text,
                      fontSize: item.depth > 0 ? font.md : font.lg,
                      fontWeight: here ? '700' : item.depth > 0 ? '400' : '600',
                      flex: 1,
                    }}
                  >
                    {item.title}
                  </Text>
                  {here && (
                    <Ionicons name="volume-medium" size={18} color={colors.accent} />
                  )}
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '78%' },
  grip: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  title: { fontWeight: '700', paddingBottom: 8 },
  list: { flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
