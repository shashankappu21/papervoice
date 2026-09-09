import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeProvider';
import {
  clampRate,
  fractionToRate,
  rateToFraction,
  snapRate,
  RATE_LIMITS,
  RATE_PRESETS,
} from '../player/rate';

interface Props {
  visible: boolean;
  rate: number;
  onChange(rate: number): void;
  onClose(): void;
}

const KNOB = 28;

/**
 * Reading speed, as a thing you drag.
 *
 * The slider is built on PanResponder, which is part of React Native itself.
 * The community slider is a native module, and a Gradle rebuild is a lot to pay
 * for one control -- particularly when the interaction is a single finger
 * moving along one axis.
 */
export function SpeedSheet({ visible, rate, onChange, onClose }: Props) {
  const { colors, space, radius, font } = useTheme();
  const [width, setWidth] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;

  // The drag needs the live track width and the rate at the moment the finger
  // went down; refs because the responder is created once and would otherwise
  // close over the first render's values for ever.
  const trackWidth = useRef(0);
  const startRate = useRef(rate);
  const latest = useRef(rate);
  latest.current = rate;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 2,
    }).start();
  }, [visible, slide]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRate.current = latest.current;
      },
      onPanResponderMove: (_event, gesture) => {
        if (trackWidth.current <= 0) return;
        const from = rateToFraction(startRate.current);
        onChange(fractionToRate(from + gesture.dx / trackWidth.current));
      },
    }),
  ).current;

  const measure = (event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.width;
    trackWidth.current = measured;
    setWidth(measured);
  };

  const fraction = rateToFraction(rate);
  const step = (by: number) => onChange(snapRate(clampRate(rate + by)));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={{
            transform: [
              { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [340, 0] }) },
            ],
          }}
        >
          <Pressable
            onPress={() => undefined}
            style={[
              styles.sheet,
              {
                backgroundColor: colors.bg,
                borderTopLeftRadius: radius.xl,
                borderTopRightRadius: radius.xl,
                padding: space.xl,
                paddingTop: space.md,
              },
            ]}
          >
            <View style={[styles.grip, { backgroundColor: colors.divider }]} />

            <Text style={[styles.title, { color: colors.text, fontSize: font.xl }]}>
              Reading speed
            </Text>

            <Text style={[styles.value, { color: colors.accent }]}>{rate.toFixed(2)}×</Text>

            <View style={[styles.sliderRow, { gap: space.md }]}>
              <Pressable
                onPress={() => step(-RATE_LIMITS.step)}
                disabled={rate <= RATE_LIMITS.min}
                accessibilityRole="button"
                accessibilityLabel="Slower"
                hitSlop={10}
                style={{ opacity: rate <= RATE_LIMITS.min ? 0.3 : 1 }}
              >
                <Ionicons name="remove-circle-outline" size={30} color={colors.text} />
              </Pressable>

              <View
                style={styles.slider}
                onLayout={measure}
                accessibilityRole="adjustable"
                accessibilityLabel="Reading speed"
                accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
                // A screen reader cannot drag, so the same control takes the
                // increment and decrement actions it does understand.
                accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                onAccessibilityAction={(event) =>
                  step(event.nativeEvent.actionName === 'increment' ? RATE_LIMITS.step : -RATE_LIMITS.step)
                }
                {...pan.panHandlers}
              >
                <View style={[styles.track, { backgroundColor: colors.divider }]}>
                  <View
                    style={[
                      styles.filled,
                      { backgroundColor: colors.accent, width: `${fraction * 100}%` },
                    ]}
                  />
                </View>
                <View
                  style={[
                    styles.knob,
                    {
                      backgroundColor: colors.accent,
                      borderColor: colors.bg,
                      left: Math.max(0, fraction * width - KNOB / 2),
                    },
                  ]}
                />
              </View>

              <Pressable
                onPress={() => step(RATE_LIMITS.step)}
                disabled={rate >= RATE_LIMITS.max}
                accessibilityRole="button"
                accessibilityLabel="Faster"
                hitSlop={10}
                style={{ opacity: rate >= RATE_LIMITS.max ? 0.3 : 1 }}
              >
                <Ionicons name="add-circle-outline" size={30} color={colors.text} />
              </Pressable>
            </View>

            <View style={[styles.presets, { gap: space.sm }]}>
              {RATE_PRESETS.map((preset) => {
                const on = Math.abs(rate - preset) < 0.001;
                return (
                  <Pressable
                    key={preset}
                    onPress={() => onChange(preset)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={({ pressed }) => [
                      styles.preset,
                      {
                        backgroundColor: on ? colors.accent : colors.surface,
                        borderRadius: radius.pill,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: on ? colors.accentOn : colors.text,
                        fontSize: font.md,
                        fontWeight: '700',
                      }}
                    >
                      {preset}×
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {},
  grip: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  title: { fontWeight: '700', textAlign: 'center' },
  value: { fontSize: 44, fontWeight: '800', textAlign: 'center', marginVertical: 12 },
  sliderRow: { flexDirection: 'row', alignItems: 'center' },
  slider: { flex: 1, height: 44, justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  filled: { height: 6 },
  knob: {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    borderWidth: 3,
  },
  presets: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 20 },
  preset: { minWidth: 62, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
