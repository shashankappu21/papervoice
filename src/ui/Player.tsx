import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeProvider';
import { PLAY_SIZE } from './theme';
import { VoiceAvatar } from './VoiceAvatar';

interface Props {
  playing: boolean;
  busy: boolean;
  /** Where the reader is, and how long the book is, in sentences. */
  position: number;
  total: number;
  /** What is left to hear, already worded -- "3h 20m left". */
  remaining: string;
  /** How far in, worded the same way. */
  elapsed: string;
  voiceName: string;
  rate: number;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onPickVoice: () => void;
  onChangeSpeed: () => void;
}

/**
 * The bar that carries the reading.
 *
 * One control dominates deliberately. Everything here is reachable one-handed
 * while walking, which is when this app is actually used, so the play button is
 * large and central and the things pressed rarely -- voice, speed -- sit at the
 * edges where a thumb lands only on purpose.
 */
export function Player({
  playing,
  busy,
  position,
  total,
  remaining,
  elapsed,
  voiceName,
  rate,
  onPlayPause,
  onPrevious,
  onNext,
  onPickVoice,
  onChangeSpeed,
}: Props) {
  const { colors, space, radius, font } = useTheme();
  const fraction = total > 0 ? Math.min(1, (position + 1) / total) : 0;

  // The bar slides to its new length rather than jumping, so a sentence
  // finishing reads as progress rather than as a redraw.
  const width = useRef(new Animated.Value(fraction)).current;
  useEffect(() => {
    Animated.timing(width, {
      toValue: fraction,
      duration: 400,
      // Width cannot run on the native driver; the bar is a few pixels tall and
      // changes once a sentence, so this is not the animation that would cost.
      useNativeDriver: false,
    }).start();
  }, [fraction, width]);

  return (
    <View style={{ backgroundColor: colors.bg, paddingBottom: space.md }}>
      <View style={[styles.track, { backgroundColor: colors.divider }]}>
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

      <View style={[styles.numbers, { paddingHorizontal: space.xl, paddingTop: space.sm }]}>
        <Text style={[styles.number, { color: colors.textMuted, fontSize: font.sm }]}>
          {elapsed}
        </Text>
        <Text style={[styles.number, { color: colors.textMuted, fontSize: font.sm }]}>
          {position + 1} of {total}
        </Text>
        <Text style={[styles.number, { color: colors.textMuted, fontSize: font.sm }]}>
          {remaining}
        </Text>
      </View>

      <View style={[styles.controls, { paddingHorizontal: space.lg, paddingTop: space.md }]}>
        <Pressable
          onPress={onPickVoice}
          accessibilityRole="button"
          accessibilityLabel={`Voice: ${voiceName}. Change voice.`}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <VoiceAvatar name={voiceName} size={44} />
        </Pressable>

        <Pressable
          onPress={onPrevious}
          accessibilityRole="button"
          accessibilityLabel="Previous sentence"
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <Ionicons name="play-skip-back" size={26} color={colors.text} />
        </Pressable>

        <PlayButton playing={playing} busy={busy} onPress={onPlayPause} />

        <Pressable
          onPress={onNext}
          accessibilityRole="button"
          accessibilityLabel="Next sentence"
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <Ionicons name="play-skip-forward" size={26} color={colors.text} />
        </Pressable>

        <Pressable
          onPress={onChangeSpeed}
          accessibilityRole="button"
          accessibilityLabel={`Speed ${rate.toFixed(2)} times. Tap to change.`}
          style={({ pressed }) => [
            styles.speed,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.pill,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '700' }}>
            {rate.toFixed(1)}×
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** The play control, which springs a little when pressed so it feels physical. */
function PlayButton({
  playing,
  busy,
  onPress,
}: {
  playing: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => spring(0.92)}
      onPressOut={() => spring(1)}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={playing ? 'Pause' : 'Play'}
      accessibilityState={{ disabled: busy, busy }}
    >
      <Animated.View
        style={[
          styles.play,
          {
            backgroundColor: colors.accent,
            transform: [{ scale }],
            opacity: busy ? 0.5 : 1,
          },
        ]}
      >
        <Ionicons
          name={playing ? 'pause' : 'play'}
          size={30}
          color={colors.accentOn}
          // Optical centring: a triangle looks off-centre in a circle when it
          // is mathematically centred.
          style={playing ? undefined : { marginLeft: 4 }}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { height: 3, width: '100%', overflow: 'hidden' },
  fill: { height: 3 },
  numbers: { flexDirection: 'row', justifyContent: 'space-between' },
  number: { fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  play: {
    width: PLAY_SIZE,
    height: PLAY_SIZE,
    borderRadius: PLAY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speed: { minWidth: 56, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
