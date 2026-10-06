import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { PermissionsAndroid, Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { audioPath } from '../tts/audioCache';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { SherpaTts } from '../../modules/sherpa-tts';
import { createSynthQueue } from '../tts/synthQueue';
import { openEngine, listAvailableVoices, type AvailableVoice, type SpeechEngine } from '../voices/engine';
import { getSetting, setSetting, SETTING_RATE, SETTING_VOICE } from '../db/settings';
import type { Sentence } from '../extraction/types';

/**
 * How many sentences to keep synthesized ahead of the listener. At the measured
 * real-time factor a handful is already minutes of audio, and the window costs
 * disk while it waits.
 */
const LOOKAHEAD = 8;

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
  /**
   * The real-time factor last measured on this device: below 1 means synthesis
   * outruns playback. It is what decides whether a voice is usable here at all.
   */
  rtf: number | null;
  /** Voices that can read right now, for choosing between without leaving. */
  voices: AvailableVoice[];
  /** The one currently loaded, or null before anything is. */
  voiceId: string | null;
  selectVoice(id: string): Promise<void>;
  /** Re-reads the installed voices, for when one has just been downloaded. */
  refreshVoices(): void;
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
  /**
   * Which book this is. Audio is filed under it, so one book's speech is never
   * mistaken for another's and neither has to be thrown away for the other.
   */
  bookId = 0,
): Playback {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [loadingVoice, setLoadingVoice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRateState] = useState(1);
  const rateRef = useRef(1);
  const [rtf, setRtf] = useState<number | null>(null);
  const [voices, setVoices] = useState<AvailableVoice[]>([]);
  const [voiceId, setVoiceId] = useState<string | null>(null);

  const player = useRef<AudioPlayer | null>(null);
  const voiceLoaded = useRef(false);
  const engine = useRef<SpeechEngine | null>(null);
  /** Which voice the loaded engine belongs to, so a change can be noticed. */
  const loadedVoiceId = useRef<string | null>(null);
  /** Loads run one after another, so the last one asked for is the one that wins. */
  const voiceLoading = useRef<Promise<void>>(Promise.resolve());
  const recentRtf = useRef<number | undefined>(undefined);
  /** The sentence playback is waiting on, when its audio is not ready yet. */
  const awaiting = useRef<number | null>(null);
  const index = useRef(initialIndex);
  const consecutiveFailures = useRef(0);

  /**
   * A new document arrives with its own place to start.
   *
   * `initialIndex` reaches the state and the ref above only on the first
   * render, which was right while this hook was mounted once per book. It now
   * outlives them -- it is mounted at launch, before any book is open -- so
   * without this a book resumed from the library would begin at zero however
   * far it had been read.
   */
  const loaded = useRef(sentences);
  useEffect(() => {
    if (loaded.current === sentences) return;
    loaded.current = sentences;
    index.current = initialIndex;
    setCurrentIndex(initialIndex);
  }, [sentences, initialIndex]);

  const cacheRoot = useMemo(() => {
    const dir = new Directory(Paths.cache, 'synth');
    if (!dir.exists) dir.create({ intermediates: true });
    return `${dir.uri.replace(/^file:\/\//, '')}/`;
  }, []);

  /*
   * Read through refs, not captured: the queue is built once per book, and the
   * voice changes while it is alive. A path built from a stale closure would
   * file this sentence's audio under the previous voice.
   */
  const voiceRef = useRef<string | null>(null);
  voiceRef.current = voiceId;

  /**
   * Makes sure the folder a sentence is about to be written into exists.
   *
   * The native engine writes to the path it is given and will not create the
   * way there, and audio now lives several folders deep -- book, voice, speed
   * -- so the way there mostly does not exist yet.
   */
  const ensureFolder = useCallback((filePath: string) => {
    const parent = filePath.slice(0, filePath.lastIndexOf('/'));
    if (!parent) return;
    const folder = new Directory(`file://${parent}`);
    if (!folder.exists) folder.create({ intermediates: true });
  }, []);

  // No speed in the key: the engine speaks at the voice's own pace and the
  // player applies the listener's speed, so a change of speed is not a reason
  // to make any audio again.
  const pathOf = useCallback(
    (index: number) =>
      audioPath(cacheRoot, {
        bookId,
        voiceId: voiceRef.current ?? 'unset',
        index,
      }),
    [cacheRoot, bookId],
  );

  const queue = useMemo(
    () =>
      createSynthQueue({
        sentences,
        pathOf,
        lookahead: LOOKAHEAD,
        exists: (path) => {
          try {
            // The path has its scheme stripped, because the native engine
            // writes to a plain path; File wants the uri back.
            return new File(path.startsWith('file://') ? path : `file://${path}`).exists;
          } catch {
            // Unreadable is the same as absent: it will simply be made again.
            return false;
          }
        },
        synthesize: async (sentence, outPath) => {
          const speaking = engine.current;
          if (!speaking) throw new Error('No voice is ready');
          ensureFolder(outPath);
          const startedAt = Date.now();
          const result = await speaking.speak(sentence, outPath, recentRtf.current);
          // Wall time for the whole call, bridge included. Summed over a run,
          // threads x this is the most CPU synthesis could have used -- the
          // figure to hold batterystats' CPU time against.
          const synthMs = Date.now() - startedAt;
          recentRtf.current = result.rtf;
          setRtf(result.rtf);
          // Logged as well as shown: comparing voices means comparing runs of
          // numbers over real sentences, not glancing at whichever was last.
          console.log(
            `[papervoice] rtf ${result.rtf.toFixed(3)} | synth ${synthMs}ms` +
              ` | ${result.durationSec.toFixed(1)}s audio | ${sentence.text.length} chars` +
              ` | ${speaking.threads ?? '-'} threads | ${speaking.label}`,
          );
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
    [sentences, pathOf, ensureFolder],
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
      voiceLoading.current = Promise.resolve();
      loadedVoiceId.current = null;
      void SherpaTts.unload();
    },
    [queue],
  );

  /**
   * Loads a voice, one at a time.
   *
   * Loads are chained rather than deduplicated: a switch asked for while
   * another load was in flight used to wait on that one and then believe it had
   * finished, leaving the old voice loaded and the new one only apparently
   * chosen. Whichever was asked for last is the one that ends up loaded.
   */
  const loadVoice = useCallback((target: string | null): Promise<void> => {
    const next = voiceLoading.current.then(async () => {
      if (voiceLoaded.current && loadedVoiceId.current === target) return;

      setLoadingVoice(true);
      try {
        // Let go of the engine being replaced, rather than holding two models.
        if (voiceLoaded.current) {
          voiceLoaded.current = false;
          engine.current = null;
          await SherpaTts.unload().catch(() => undefined);
        }

        const opened = await openEngine(target);
        engine.current = opened.engine;
        voiceLoaded.current = true;
        // What actually loaded, which is not always what was asked for.
        loadedVoiceId.current = opened.voiceId;
        setVoiceId(opened.voiceId);
      } finally {
        setLoadingVoice(false);
      }
    });

    // A failure must not poison the chain for every later load.
    voiceLoading.current = next.catch(() => undefined);
    return next;
  }, []);

  const ensureVoice = useCallback(async (): Promise<void> => {
    if (voiceLoaded.current) return;
    await loadVoice(await getSetting(SETTING_VOICE));
  }, [loadVoice]);

  /**
   * Re-reads which voices are available.
   *
   * The list was read once, when this was first mounted -- which is app
   * launch, since the reading outlives every screen. A voice downloaded after
   * that did not appear until the app was restarted, because nothing ever
   * asked again.
   */
  const refreshVoices = useCallback(() => {
    listAvailableVoices().then(setVoices, () => setVoices([]));
  }, []);

  useEffect(refreshVoices, [refreshVoices]);

  /**
   * Changes voice without leaving the page or losing the place.
   *
   * Everything already synthesised was spoken by the voice being replaced, so
   * it is thrown away and made again: half a chapter in one voice and half in
   * another is worse than a moment's wait.
   */
  const selectVoice = async (id: string) => {
    const wasPlaying = playing;
    player.current?.pause();
    setPlaying(false);
    awaiting.current = null;
    setBuffering(false);

    try {
      setError(null);
      await setSetting(SETTING_VOICE, id);
      // Each voice is measured on its own; the last one's figure means nothing
      // about this one.
      recentRtf.current = undefined;
      setRtf(null);
      await loadVoice(id);
      await queue.start(index.current);

      if (wasPlaying) {
        const path = queue.pathFor(index.current);
        if (path) startTrack(path);
        else {
          awaiting.current = index.current;
          setBuffering(true);
        }
      }
    } catch (cause) {
      console.log('[papervoice] voice switch failed:', String(cause));
      setError(`Voice unavailable: ${String(cause)}`);
    }
  };

  // Load the voice as soon as there is something to read. It takes seconds, and
  // doing it on the first press makes the app look broken while it waits.
  useEffect(() => {
    if (sentences.length === 0) return;
    ensureVoice().catch((cause: unknown) => {
      console.log('[papervoice] voice load failed:', String(cause));
      setError(`Voice unavailable: ${String(cause)}`);
    });
  }, [sentences.length, ensureVoice]);

  /**
   * Picks up a voice chosen while this screen was away.
   *
   * Everything already synthesised was spoken by the previous voice, so it is
   * thrown away and made again: half a chapter in one voice and half in another
   * is worse than a moment's wait.
   */
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      void (async () => {
        const chosen = (await getSetting(SETTING_VOICE)) ?? null;
        if (cancelled || !voiceLoaded.current || chosen === loadedVoiceId.current) return;

        player.current?.pause();
        setPlaying(false);
        awaiting.current = null;
        setBuffering(false);

        try {
          await ensureVoice();
          if (cancelled) return;
          await queue.start(index.current);
        } catch (cause) {
          if (!cancelled) setError(`Voice unavailable: ${String(cause)}`);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [ensureVoice, queue]),
  );

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
    rtf,
    voices,
    refreshVoices,
    voiceId,
    selectVoice,
    play,
    pause,
    jumpTo,
    setRate,
  };
}
