import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ui/ThemeProvider';
import { useTour } from './TourProvider';
import { TOURS } from './steps';
import { captionSide, cutOut } from './spotlight';

/** Room left around a highlighted control, so it is not pressed against the dark. */
const MARGIN = 10;

/**
 * The guided tour, drawn over whatever screen is showing.
 *
 * The dimming is four rectangles around the control rather than one sheet with
 * a bright ring on it, which leaves a genuine hole: the control underneath can
 * still be pressed. A tour you can only watch teaches less than one you can
 * use, and the button being pressable is the whole difference.
 *
 * Tapping the dark advances. Tapping the hole does whatever the control does,
 * and advances as well -- pressing play during the step about play should not
 * then need a second tap to move on.
 */
export function TourOverlay() {
  const { tour, step, targets, next, finish } = useTour();
  const { colors, space, radius, font } = useTheme();
  const screen = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const fade = useRef(new Animated.Value(0)).current;
  const steps = tour ? TOURS[tour] : [];
  const current = steps[step];
  const target = current?.target ? (targets[current.target] ?? null) : null;

  // Waiting, rather than pointing at the corner while the layout settles.
  const waiting = Boolean(current?.target) && target === null;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: tour && !waiting ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [tour, waiting, step, fade]);

  if (!tour || !current || waiting) return null;

  const [top, bottom, left, right] = cutOut(target, screen, MARGIN);
  const side = captionSide(target, screen);
  const last = step === steps.length - 1;

  const caption = (
    <View
      style={[
        styles.caption,
        {
          backgroundColor: colors.bg,
          borderRadius: radius.xl,
          padding: space.xl,
          marginHorizontal: space.lg,
        },
      ]}
    >
      <Text style={{ color: colors.text, fontSize: font.xl, fontWeight: '700' }}>
        {current.title}
      </Text>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: font.md,
          lineHeight: 22,
          marginTop: space.sm,
        }}
      >
        {current.body}
      </Text>

      <View style={[styles.actions, { marginTop: space.lg, gap: space.sm }]}>
        <Text style={{ color: colors.textMuted, fontSize: font.sm, flex: 1 }}>
          {step + 1} of {steps.length}
        </Text>

        {!last && (
          <Pressable
            onPress={finish}
            accessibilityRole="button"
            hitSlop={10}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingHorizontal: space.sm })}
          >
            <Text style={{ color: colors.textMuted, fontSize: font.md }}>Skip</Text>
          </Pressable>
        )}

        <Pressable
          onPress={next}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.next,
            {
              backgroundColor: colors.accent,
              borderRadius: radius.pill,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Text style={{ color: colors.accentOn, fontSize: font.md, fontWeight: '700' }}>
            {last ? 'Got it' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    // box-none: this view does not take touches, only its children do, which
    // is what leaves the hole open.
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]} pointerEvents="box-none">
      {[top, bottom, left, right].map((piece, index) => (
        <Pressable
          key={index}
          onPress={next}
          // Advancing by tapping the dark is undocumented on purpose: the
          // button says what to do, and this is for people who have worked it
          // out and want to move faster.
          accessible={false}
          style={[styles.dim, piece]}
        />
      ))}

      {target && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: target.x - MARGIN,
            top: target.y - MARGIN,
            width: target.width + MARGIN * 2,
            height: target.height + MARGIN * 2,
            borderRadius: radius.lg,
            borderWidth: 2,
            borderColor: colors.accent,
          }}
        />
      )}

      <View
        pointerEvents="box-none"
        style={[
          styles.captionSlot,
          side === 'above'
            ? { bottom: screen.height - (target?.y ?? 0) + MARGIN * 2, top: undefined }
            : side === 'below'
              ? { top: (target?.y ?? 0) + (target?.height ?? 0) + MARGIN * 3 }
              : { top: 0, bottom: 0, justifyContent: 'center' },
          { paddingBottom: insets.bottom },
        ]}
      >
        {caption}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.72)' },
  captionSlot: { position: 'absolute', left: 0, right: 0 },
  caption: { maxWidth: 460, alignSelf: 'center', width: '100%' },
  actions: { flexDirection: 'row', alignItems: 'center' },
  next: { minHeight: 44, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
});
