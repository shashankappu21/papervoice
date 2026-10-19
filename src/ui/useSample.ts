import { useCallback, useEffect, useRef, useState } from 'react';
import { createAudioPlayer, type AudioPlayer, type AudioSource } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import { SystemTts } from '../../modules/system-tts';
import { isSystemVoice, SYSTEM_PREFIX } from '../voices/engine';
import { SAMPLE_SENTENCE, sampleFor } from '../voices/samples';

/**
 * The phone's own voices have no recording to ship -- which ones a phone has
 * is only known on the phone -- so the phone says the sentence there and then.
 */
async function phoneSample(voiceId: string): Promise<{ path: string; durationSec: number }> {
  const dir = new Directory(Paths.cache, 'samples');
  if (!dir.exists) dir.create({ intermediates: true });
  // One file per voice, so a sample still being written is never the one playing.
  const file = new File(dir, `${voiceId.replace(/[^\w-]/g, '_')}.wav`);
  return SystemTts.synthesize(SAMPLE_SENTENCE, voiceId, file.uri.replace(/^file:\/\//, ''));
}

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
  /** Bumped by every stop, so a phone sample still being spoken is not then played. */
  const attempt = useRef(0);

  const stop = useCallback(() => {
    attempt.current += 1;
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

      const start = (source: AudioSource, lengthMs: number) => {
        try {
          const sample = createAudioPlayer(source);
          player.current = sample;
          setPlaying(voiceId);
          sample.play();

          /*
           * A timer rather than a finished event. The samples are a known few
           * seconds long, and this only drives the icon -- a status listener
           * per sample, torn down on every tap, is more machinery than the
           * question deserves.
           */
          done.current = setTimeout(stop, lengthMs);
        } catch {
          setPlaying(null);
        }
      };

      if (isSystemVoice(voiceId)) {
        const mine = attempt.current;
        // Shown as playing straight away: the phone takes a moment to speak it.
        setPlaying(voiceId);
        phoneSample(voiceId.slice(SYSTEM_PREFIX.length))
          .then(({ path, durationSec }) => {
            if (attempt.current === mine) start({ uri: `file://${path}` }, durationSec * 1000 + 500);
          })
          .catch(() => {
            if (attempt.current === mine) setPlaying(null);
          });
        return;
      }

      const asset = sampleFor(voiceId);
      if (asset === null) return;
      start(asset, 8000);
    },
    [playing, stop],
  );

  return { play, stop, playing };
}
