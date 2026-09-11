import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ui/ThemeProvider';
import { useTour } from './TourProvider';
import { TOURS } from './steps';
import { captionSide, cutOut } from './spotlight';

/** Room left around a highlighted control, so it is not pressed against the dark. */
const MARGIN = 10;

/**
 * How long to wait for a control to report where it is before giving up on it.
 *
 * Some steps point at things that are not always there -- the contents button
 * is absent from a book with no chapters -- and a step waiting on one of those
 * would hold the whole tour, invisibly, for ever.
 */
const PATIENCE_MS = 1500;

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
  const insets = useSafeAreaInsets();

  /*
   * The overlay's own height, measured rather than taken from the window.
   * A window reports a height that leaves the system bars out under
   * edge-to-edge layout, while controls are measured in a space that includes
   * them -- so the two numbers disagree by exactly the amount that put the
   * spotlight in the wrong place.
   */
  const [height, setHeight] = useState(0);

  const fade = useRef(new Animated.Value(0)).current;
  const steps = tour ? TOURS[tour] : [];
  const current = steps[step];
  const target = current?.target ? (targets[current.target] ?? null) : null;

  /*
   * Steps whose control never turned up, and which are shown anyway.
   *
   * Kept per step rather than as one flag: giving up on one step must not
   * make the next one give up before it has been looked for.
   */
  const [abandoned, setAbandoned] = useState<Record<string, boolean>>({});
  const gaveUp = abandoned[`${tour}:${step}`] === true;

  // Waiting, rather than pointing at the corner while the layout settles.
  const waiting = Boolean(current?.target) && target === null && !gaveUp;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: tour && !waiting ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [tour, waiting, step, fade]);

  /*
   * A control that never turns up.
   *
   * Some steps are meaningless without theirs and are skipped -- there is
   * nothing to say about jumping to a chapter in a book that has none. Others
   * are worth making regardless, and those lose their spotlight and keep their
   * words: the group chips do not exist until there is a book to put in one,
   * and someone opening the app for the first time is exactly who needs
   * telling that groups are there at all.
   */
  useEffect(() => {
    if (!tour || !waiting) return;
    const timer = setTimeout(() => {
      if (current?.whenMissing === 'show') {
        setAbandoned((given) => ({ ...given, [`${tour}:${step}`]: true }));
      } else {
        next();
      }
    }, PATIENCE_MS);
    return () => clearTimeout(timer);
  }, [tour, waiting, step, next, current?.whenMissing]);

  if (!tour || !current || waiting) return null;

  const panels = cutOut(target, MARGIN);
  const side = captionSide(target, height);
  const last = step === steps.length - 1;

  // Square within a few pixels, and small: that is a round button.
  const round =
    target !== null && Math.abs(target.width - target.height) < 6 && target.width < 120;

  /*
   * Kept inside the screen. A control at the very bottom -- anything in the
   * tab bar -- otherwise gets a ring whose lower half is cut off by the edge,
   * which looks like a drawing error rather than a highlight.
   */
  const ringHeight =
    target === null
      ? 0
      : height > 0
        ? Math.min(target.height + MARGIN * 2, Math.max(0, height - (target.y - MARGIN)))
        : target.height + MARGIN * 2;

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
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity: fade }]}
      pointerEvents="box-none"
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
    >
      {panels.map((piece, index) => (
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
            height: ringHeight,
            /*
             * A round control gets a round ring. A rounded rectangle drawn
             * around a circle reads as a mistake, and the import button is a
             * circle.
             */
            borderRadius: round ? (target.width + MARGIN * 2) / 2 : radius.lg,
            borderWidth: 2,
            borderColor: colors.accent,
          }}
        />
      )}

      <View
        pointerEvents="box-none"
        style={[
          styles.captionSlot,
          // Anchored to the same edges the panels use, so the caption and the
          // hole cannot drift apart.
          side === 'above'
            ? { bottom: Math.max(0, height - (target?.y ?? 0) + MARGIN * 2) }
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
