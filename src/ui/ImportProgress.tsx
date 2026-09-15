import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeProvider';

interface Props {
  title: string;
  /** Pages read so far and pages in total, once the document has been opened. */
  page: number;
  total: number;
  /** Shown instead of the pages when there is no page count yet, or on failure. */
  message: string | null;
  failed: boolean;
  onDismiss(): void;
}

/**
 * What importing a book looks like while it happens.
 *
 * A long book takes a while to read, and the app was saying so in a thin grey
 * strip at the bottom of the screen. That reads as something going wrong in
 * the background rather than as the thing you just asked for, so it is the
 * whole screen's attention now.
 *
 * It also says where the work is happening. "On this phone" is the reason this
 * takes seconds at all -- every other app of this kind uploads the file and
 * gets it back quickly -- so the wait is worth explaining rather than hiding.
 */
export function ImportProgress({ title, page, total, message, failed, onDismiss }: Props) {
  const { colors, space, radius, font } = useTheme();
  const fraction = total > 0 ? page / total : 0;

  const width = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(width, {
      toValue: fraction,
      duration: 250,
      // Width cannot run on the native driver, and this moves once a page.
      useNativeDriver: false,
    }).start();
  }, [fraction, width]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      {/*
        Opaque, not a scrim over the library.

        It was rgba(0,0,0,0.55), and the extractor's WebView showed through it
        as a white block filling the lower half of the screen -- measured as
        rgb(113,113,113) every time, which is white at 45%. That WebView cannot
        be hidden: on Android it takes a surface of its own that the system
        composites regardless of the view's size, opacity, position or layer
        type, all four of which were tried.
        
        So nothing translucent is put in front of it. An import is a
        full-screen wait with one thing to look at; there was never much to be
        gained from seeing the dimmed library behind it.
      */}
      <View style={[styles.backdrop, { backgroundColor: colors.bg }]}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.bg, borderRadius: radius.xl, padding: space.xxl },
          ]}
        >
          <View
            style={[
              styles.badge,
              {
                backgroundColor: failed ? colors.danger : colors.accent,
                borderRadius: radius.lg,
              },
            ]}
          >
            <Ionicons
              name={failed ? 'alert' : 'document-text'}
              size={26}
              color={colors.accentOn}
            />
          </View>

          <Text
            numberOfLines={2}
            style={[styles.title, { color: colors.text, fontSize: font.xl, marginTop: space.lg }]}
          >
            {failed ? 'Could not read that PDF' : title}
          </Text>

          {failed ? (
            <Text
              style={{
                color: colors.textMuted,
                fontSize: font.sm,
                textAlign: 'center',
                marginTop: space.sm,
                lineHeight: 19,
              }}
            >
              {message}
            </Text>
          ) : null}

          {failed ? (
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.dismiss,
                {
                  backgroundColor: colors.accent,
                  borderRadius: radius.pill,
                  marginTop: space.lg,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={{ color: colors.accentOn, fontSize: font.md, fontWeight: '700' }}>
                Close
              </Text>
            </Pressable>
          ) : (
            <>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: font.sm,
                  marginTop: space.xs,
                }}
              >
                {total > 0 ? `Reading page ${page} of ${total}` : (message ?? 'Opening…')}
              </Text>

              <View
                style={[
                  styles.track,
                  { backgroundColor: colors.divider, marginTop: space.lg },
                ]}
              >
                <Animated.View
                  style={[
                    styles.fill,
                    {
                      backgroundColor: colors.accent,
                      width: width.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>

              <View style={[styles.note, { marginTop: space.lg, gap: space.sm }]}>
                <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, fontSize: font.xs, flex: 1 }}>
                  Happening on this phone. The document is not being uploaded anywhere.
                </Text>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: { width: '100%', maxWidth: 380, alignItems: 'center' },
  badge: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '700', textAlign: 'center' },
  track: { height: 6, width: '100%', borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6 },
  note: { flexDirection: 'row', alignItems: 'center' },
  dismiss: { minHeight: 44, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
});
