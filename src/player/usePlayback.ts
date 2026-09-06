import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { Directory, Paths } from 'expo-file-system';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { SherpaTts } from '../../modules/sherpa-tts';
import { createSynthQueue } from '../tts/synthQueue';
import { speakable } from '../tts/speakable';
import { chunk } from '../tts/chunk';
import { pauseAfter } from '../tts/pauses';
import { LJSPEECH, voicePaths } from '../tts/modelPaths';
import { getSetting, setSetting, SETTING_RATE } from '../db/settings';
import type { Sentence } from '../extraction/types';

/**
 * How many sentences to keep synthesized ahead of the listener. At the measured
 * real-time factor a handful is already minutes of audio, and the window costs
 * disk while it waits.
 */
const LOOKAHEAD = 8;

/** How long an utterance may be before it is cut into separate synthesis jobs. */
const CHUNK_LIMIT = 300;

/** Silence between the pieces of one sentence, where a full pause would be heard. */
const SEAM_MS = 90;

/**
 * How many sentences may fail in a row before playback stops and says so.
 *
 * One failure is a bad sentence and must not stop a book. A run of them is the
 * engine being broken, and skipping silently through a whole document while
 * reporting nothing is worse than halting.
 */
const FAILURES_BEFORE_GIVING_UP = 3;

export interface Playback {
  /** The sentence being spoken, which is what the reader highlights. */
  currentIndex: number;
  playing: boolean;
  /** True while waiting on synthesis rather than on the listener. */
  buffering: boolean;
  /**
   * True while the voice itself is being loaded, which takes seconds: a 63MB
   * model and a 21MB runtime, read cold. It happens once per session and is
   * started as soon as a document is open, so pressing play rarely waits.
   */
  loadingVoice: boolean;
  error: string | null;
  /** Playback speed, where 1 is the voice's own pace. */
  rate: number;
  play(from?: number): Promise<void>;
  pause(): void;
  jumpTo(index: number): Promise<void>;
  setRate(rate: number): void;
}

/** The range worth offering: below this is a drawl, above it is unintelligible. */
export const RATE_RANGE = { min: 0.5, max: 3, step: 0.1 };

/**
 * Reads a document aloud, keeping synthesis ahead of playback.
 *
 * One sentence is one audio file and one track, so the index being played is
 * the index being read -- which is what the highlight follows and what a saved
 * position records.
 */
export function usePlayback(
  sentences: Sentence[],
  title: string,
  /** Where to pick up: a saved position, or the start of a new book. */
  initialIndex = 0,
): Playback {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [loadingVoice, setLoadingVoice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRateState] = useState(1);
  const rateRef = useRef(1);

  const player = useRef<AudioPlayer | null>(null);
  const voiceLoaded = useRef(false);
  /** The load in flight, so concurrent callers wait on one rather than racing. */
  const voiceLoading = useRef<Promise<void> | null>(null);
  const recentRtf = useRef<number | undefined>(undefined);
  /** The sentence playback is waiting on, when its audio is not ready yet. */
  const awaiting = useRef<number | null>(null);
  const index = useRef(initialIndex);
  const consecutiveFailures = useRef(0);

  const cacheDir = useMemo(() => {
    const dir = new Directory(Paths.cache, 'synth');
    if (!dir.exists) dir.create({ intermediates: true });
    return `${dir.uri.replace(/^file:\/\//, '')}/`;
  }, []);

  const queue = useMemo(
    () =>
      createSynthQueue({
        sentences,
        cacheDir,
        lookahead: LOOKAHEAD,
        synthesize: async (sentence, outPath) => {
          const parts = chunk(speakable(sentence.text), CHUNK_LIMIT);
          const tailMs = pauseAfter({
            kind: sentence.kind,
            endsSentence: true,
            rtf: recentRtf.current,
          });
          const result = await SherpaTts.synthesize(parts, 0, 1.0, outPath, SEAM_MS, tailMs);
          recentRtf.current = result.rtf;
          consecutiveFailures.current = 0;
          return result;
        },
        onReady: (ready, path) => {
          // Playback may have caught up with synthesis and be sitting idle.
          if (awaiting.current === ready) {
            awaiting.current = null;
            setBuffering(false);
            startTrack(path);
          }
        },
        onFailed: (failed, cause) => {
          consecutiveFailures.current += 1;
          if (consecutiveFailures.current >= FAILURES_BEFORE_GIVING_UP) {
            awaiting.current = null;
            setBuffering(false);
            setPlaying(false);
            setError(`Speech failed: ${cause.message}`);
            queue.stop();
            return;
          }
          // A single bad sentence must not stop the book.
          if (awaiting.current === failed) advance();
        },
      }),
    // startTrack and advance are stable for the life of the hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sentences, cacheDir],
  );

  const startTrack = (path: string) => {
    const current = player.current;
    if (!current) return;
    current.replace({ uri: `file://${path}` });
    // The rate belongs to the player, and replacing the source resets it, so it
    // has to be applied to every track rather than once.
    current.setPlaybackRate(rateRef.current, 'high');
    current.play();
    setPlaying(true);
  };

  /** Moves to the next sentence, playing it now if its audio already exists. */
  const advance = useCallback(() => {
    const next = index.current + 1;
    if (next >= sentences.length) {
      setPlaying(false);
      return;
    }

    index.current = next;
    setCurrentIndex(next);
    queue.setCurrent(next);

    const path = queue.pathFor(next);
    if (path) {
      startTrack(path);
    } else {
      // Synthesis has not caught up. onReady resumes when it does.
      awaiting.current = next;
      setBuffering(true);
    }
  }, [queue, sentences.length]);

  // One player for the whole session: lock screen controls belong to a player,
  // and handing them between players loses them.
  useEffect(() => {
    const created = createAudioPlayer(null);
    // Speeding a voice up must not raise its pitch: the brief asks for a rate
    // control, not a chipmunk.
    created.shouldCorrectPitch = true;
    player.current = created;

    const subscription = created.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) advance();
    });

    return () => {
      subscription.remove();
      created.clearLockScreenControls();
      created.remove();
      player.current = null;
    };
  }, [advance]);

  useEffect(
    () => () => {
      queue.stop();
      // The engine is being released, so the flag that says it is loaded has to
      // go with it. Left set, the next synthesis would call into an engine that
      // is no longer there and fail on every sentence.
      voiceLoaded.current = false;
      voiceLoading.current = null;
      void SherpaTts.unload();
    },
    [queue],
  );

  const ensureVoice = useCallback((): Promise<void> => {
    if (voiceLoaded.current) return Promise.resolve();
    if (voiceLoading.current) return voiceLoading.current;

    setLoadingVoice(true);
    const paths = voicePaths(LJSPEECH.id, LJSPEECH.file);
    const loading = SherpaTts.load(paths.model, paths.tokens, paths.dataDir, 2)
      .then(() => {
        voiceLoaded.current = true;
      })
      .catch((cause: unknown) => {
        // Let the next attempt try again rather than caching the failure.
        voiceLoading.current = null;
        throw cause;
      })
      .finally(() => setLoadingVoice(false));

    voiceLoading.current = loading;
    return loading;
  }, []);

  // The reader's chosen speed outlives the session, and the book they chose it
  // on: someone who listens at 1.6x listens at 1.6x to everything.
  useEffect(() => {
    getSetting(SETTING_RATE).then((saved) => {
      const value = Number(saved);
      if (!saved || Number.isNaN(value)) return;
      rateRef.current = value;
      setRateState(value);
      player.current?.setPlaybackRate(value, 'high');
    }, () => undefined);
  }, []);

  // Load the voice as soon as there is something to read. It takes seconds, and
  // doing it on the first press makes the app look broken while it waits.
  useEffect(() => {
    if (sentences.length === 0) return;
    ensureVoice().catch((cause: unknown) => setError(`Voice unavailable: ${String(cause)}`));
  }, [sentences.length, ensureVoice]);

  const play = async (from = index.current) => {
    try {
      setError(null);
      // Without this permission the media notification never appears, and with
      // it the lock screen controls. Playback still works, so a refusal is a
      // missing convenience rather than a failure.
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS');
      }

      await ensureVoice();

      index.current = from;
      setCurrentIndex(from);
      consecutiveFailures.current = 0;
      await queue.start(from);

      // The lock screen keeps the foreground service alive; without it Android
      // stops background playback after roughly three minutes.
      player.current?.setActiveForLockScreen(true, { title, artist: 'Papervoice' });

      const path = queue.pathFor(from);
      if (path) {
        startTrack(path);
      } else {
        awaiting.current = from;
        setBuffering(true);
      }
    } catch (cause) {
      setError(String(cause));
      setPlaying(false);
      setBuffering(false);
    }
  };

  const pause = () => {
    player.current?.pause();
    setPlaying(false);
  };

  /**
   * Changes speed without re-synthesising: the engine could speak faster, but
   * that would throw away every sentence already made and stall the listener.
   * Pitch correction keeps the voice from turning into a chipmunk.
   */
  const setRate = (next: number) => {
    const clamped = Math.min(RATE_RANGE.max, Math.max(RATE_RANGE.min, next));
    rateRef.current = clamped;
    setRateState(clamped);
    player.current?.setPlaybackRate(clamped, 'high');
    void setSetting(SETTING_RATE, String(clamped));
  };

  const jumpTo = async (to: number) => {
    pause();
    awaiting.current = null;
    await play(to);
  };

  return {
    currentIndex,
    playing,
    buffering,
    loadingVoice,
    error,
    rate,
    play,
    pause,
    jumpTo,
    setRate,
  };
}
