import { useCallback, useEffect, useRef, useState } from 'react';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { sampleFor } from '../voices/samples';

/**
 * Plays the short recording of a voice.
 *
 * Its own player, separate from the one reading the book. Sharing that one
 * would mean a sample interrupting a chapter and leaving the queue pointed at
 * the wrong file; this just plays a few seconds and stops.
 *
 * Only one sample at a time. Tapping through a list of voices quickly is the
 * normal way to use this, and without stopping the last one you end up with
 * several talking at once.
 */
export function useSample() {
  const player = useRef<AudioPlayer | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const done = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (done.current) clearTimeout(done.current);
    done.current = null;
    try {
      /*
       * Paused first, and that order is the whole fix.
       *
       * `remove()` is documented as "remove the player from memory to free up
       * resources" -- it releases the object, it does not stop the sound.
       * Dropping the reference on a playing sample left it playing with
       * nothing holding it, so tapping through the list stacked up voices all
       * talking over each other. expo-audio has no stop(); pause() is it.
       */
      player.current?.pause();
      player.current?.remove();
    } catch {
      // Already gone. Nothing to release.
    }
    player.current = null;
    setPlaying(null);
  }, []);

  // A sample must not outlive the screen that started it.
  useEffect(() => stop, [stop]);

  const play = useCallback(
    (voiceId: string) => {
      // Tapping the one that is playing stops it, which is what the button
      // showing a stop icon implies.
      if (playing === voiceId) {
        stop();
        return;
      }

      stop();

      const asset = sampleFor(voiceId);
      if (asset === null) return;

      try {
        const sample = createAudioPlayer(asset);
        player.current = sample;
        setPlaying(voiceId);
        sample.play();

        /*
         * A timer rather than a finished event. The samples are a known few
         * seconds long, and this only drives the icon -- a status listener
         * per sample, torn down on every tap, is more machinery than the
         * question deserves.
         */
        done.current = setTimeout(stop, 8000);
      } catch {
        setPlaying(null);
      }
    },
    [playing, stop],
  );

  return { play, stop, playing };
}
