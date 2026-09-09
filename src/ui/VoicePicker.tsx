import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeProvider';
import { VoiceAvatar } from './VoiceAvatar';
import type { AvailableVoice } from '../voices/engine';

interface Props {
  visible: boolean;
  voices: AvailableVoice[];
  chosenId: string | null;
  onClose(): void;
  onChoose(id: string): void;
}

/**
 * Choosing a voice, as a sheet that rises from the bottom.
 *
 * It slides rather than appears. A panel that is simply there has to be read to
 * be understood; one that arrives from the edge it is anchored to has already
 * explained itself by the time it stops.
 */
export function VoicePicker({ visible, voices, chosenId, onClose, onChoose }: Props) {
  const { colors, space, radius, font } = useTheme();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 2,
    }).start();
  }, [visible, slide]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={{
            transform: [
              { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) },
            ],
          }}
        >
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.bg,
                borderTopLeftRadius: radius.xl,
                borderTopRightRadius: radius.xl,
                paddingTop: space.md,
              },
            ]}
            onPress={() => undefined}
          >
            <View style={[styles.grip, { backgroundColor: colors.divider }]} />

            <Text
              style={[
                styles.title,
                { color: colors.text, fontSize: font.xl, paddingHorizontal: space.xl },
              ]}
            >
              Read with
            </Text>

            <ScrollView contentContainerStyle={{ paddingBottom: space.xxxl }}>
              {voices.map((voice) => {
                const chosen = voice.id === chosenId;
                return (
                  <Pressable
                    key={voice.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: chosen }}
                    onPress={() => onChoose(voice.id)}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        paddingHorizontal: space.xl,
                        paddingVertical: space.md,
                        backgroundColor: pressed ? colors.surface : 'transparent',
                      },
                    ]}
                  >
                    <VoiceAvatar name={voice.label} size={48} />
                    <View style={styles.rowText}>
                      <Text
                        style={{
                          color: colors.text,
                          fontSize: font.lg,
                          fontWeight: chosen ? '700' : '600',
                        }}
                      >
                        {voice.label}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: font.sm, marginTop: 2 }}>
                        {voice.detail}
                        {chosen ? ' · reading now' : ''}
                      </Text>
                    </View>
                    {/* A tick as well as weight, because colour alone is
                        invisible to a reader who cannot distinguish it. */}
                    {chosen && <Ionicons name="checkmark-circle" size={24} color={colors.accent} />}
                  </Pressable>
                );
              })}

              {voices.length === 0 && (
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: font.md,
                    padding: space.xl,
                    lineHeight: 21,
                  }}
                >
                  No voice is available yet. Download one from the Voices tab.
                </Text>
              )}
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '72%' },
  grip: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  title: { fontWeight: '700', paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowText: { flex: 1 },
});
