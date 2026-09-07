import { SherpaTts } from '../../modules/sherpa-tts';
import { SystemTts, type SystemVoice } from '../../modules/system-tts';
import { VOICES, findVoice, type VoiceMeta } from './catalog';
import { voiceStore, voiceLoadPaths } from './deviceVoices';
import type { Sentence } from '../extraction/types';
import { speakable } from '../tts/speakable';
import { chunk } from '../tts/chunk';
import { pauseAfter } from '../tts/pauses';

/**
 * Speaking a sentence, whichever voice is doing it.
 *
 * The phone's own voice and a downloaded neural one both write one WAV per
 * sentence, so everything above this line -- the queue, the highlight, the saved
 * position, the lock screen -- works the same either way and never asks which
 * engine is running.
 */

/** A system voice is identified by this prefix; anything else is from the catalog. */
export const SYSTEM_PREFIX = 'system:';

export const systemVoiceId = (voice: SystemVoice) => `${SYSTEM_PREFIX}${voice.id}`;
export const isSystemVoice = (id: string) => id.startsWith(SYSTEM_PREFIX);

/** How long an utterance may be before it is cut into separate synthesis jobs. */
const CHUNK_LIMIT = 300;

/** Silence between the pieces of one sentence, where a full pause would be heard. */
const SEAM_MS = 90;

export interface SpeechEngine {
  /** Human name for what is speaking, for the screen to show. */
  label: string;
  speak(sentence: Sentence, outPath: string, rtf?: number): Promise<{ path: string; durationSec: number; rtf: number }>;
}

export interface SystemVoices {
  usable: SystemVoice[];
  /** How many were left out for needing the network, so the screen can say so. */
  hiddenForNetwork: number;
}

/** The English voices the phone already has, minus the ones that phone home. */
export async function listUsableSystemVoices(): Promise<SystemVoices> {
  const voices = await SystemTts.listVoices();
  // A voice that speaks over the network sends the document away, which is the
  // one thing this app promises not to do, so it is not offered at all. The
  // count is kept because silently showing fewer voices than the phone has
  // looks like a bug rather than a decision.
  const usable = voices
    .filter((voice) => !voice.needsNetwork)
    .sort((a, b) => b.quality - a.quality);

  return { usable, hiddenForNetwork: voices.length - usable.length };
}

/**
 * A name worth showing. Android names a voice things like `en-us-x-iom-local`,
 * which tells a reader nothing, so the locale is spelled out instead.
 */
export function systemVoiceLabel(voice: SystemVoice): string {
  const fallback = voice.locale || voice.id;
  try {
    const [language, region] = voice.locale.split('-');
    // Android reports locales three-letter as well as two ("eng-NGA"), and
    // DisplayNames answers undefined for names it does not know rather than
    // throwing -- which is how a voice ended up displayed with no name at all.
    const named = new Intl.DisplayNames(['en'], { type: 'language' }).of(language);
    if (!named || named === language) return fallback;

    const place = region
      ? new Intl.DisplayNames(['en'], { type: 'region' }).of(region.toUpperCase())
      : null;

    return place && place !== region ? `${named} (${place})` : named;
  } catch {
    return fallback;
  }
}

export interface AvailableVoice {
  id: string;
  label: string;
  detail: string;
}

/**
 * Everything that can read right now: the voices downloaded, and the ones the
 * phone came with. Nothing here needs a connection, so the list is the same
 * offline as on.
 */
export async function listAvailableVoices(): Promise<AvailableVoice[]> {
  const store = voiceStore();
  const downloaded = VOICES.filter((voice) => store.isInstalled(voice)).map((voice) => ({
    id: voice.id,
    label: voice.name,
    detail: `${voice.accent} · ${voice.gender} · natural`,
  }));

  const { usable } = await listUsableSystemVoices();
  const system = usable.map((voice) => ({
    id: systemVoiceId(voice),
    label: systemVoiceLabel(voice),
    detail: 'system voice',
  }));

  // Downloaded voices first: someone who took the trouble to install one is
  // unlikely to be looking for the one that was already there.
  return [...downloaded, ...system];
}

export interface OpenedVoice {
  engine: SpeechEngine;
  /**
   * What was actually loaded, which is not always what was asked for: a saved
   * voice can belong to an engine the phone no longer uses, and nothing was
   * chosen at all the first time. The screen shows this, not the request.
   */
  voiceId: string;
}

/** Prepares whichever engine the chosen voice belongs to. */
export async function openEngine(chosenId: string | null): Promise<OpenedVoice> {
  const store = voiceStore();

  if (chosenId && isSystemVoice(chosenId)) {
    const wanted = chosenId.slice(SYSTEM_PREFIX.length);
    const { usable } = await listUsableSystemVoices();
    // Changing the phone's speech engine changes the names of its voices, so a
    // saved one can simply cease to exist. That is not an error worth stopping
    // for; it is a reason to pick something that does.
    if (usable.some((voice) => voice.id === wanted)) {
      return { engine: systemEngine(wanted), voiceId: chosenId };
    }
  } else {
    const voice =
      (chosenId ? findVoice(chosenId) : undefined) ??
      VOICES.find((candidate) => store.isInstalled(candidate));
    if (voice && store.isInstalled(voice)) {
      return { engine: await neuralEngine(voice), voiceId: voice.id };
    }
  }

  // Nothing chosen, or what was chosen has gone: fall back to the phone's own
  // voice rather than refusing to read, which is the point of having a floor.
  const { usable } = await listUsableSystemVoices();
  if (usable.length === 0) {
    throw new Error('This phone has no offline voice, and no voice has been downloaded yet.');
  }
  return { engine: systemEngine(usable[0].id), voiceId: systemVoiceId(usable[0]) };
}

async function neuralEngine(voice: VoiceMeta): Promise<SpeechEngine> {
  const paths = await voiceLoadPaths(voice);

  if (voice.family === 'kokoro') {
    const phonemes = voice.phonemes ?? { useEspeak: true, lang: 'en-us' };
    await SherpaTts.loadKokoro(
      paths.model,
      paths.voices,
      paths.tokens,
      phonemes.useEspeak ? paths.dataDir : '',
      voice.lexiconUrl ? paths.lexicon : '',
      phonemes.lang,
      2,
    );
  } else {
    await SherpaTts.load(paths.model, paths.tokens, paths.dataDir, 2);
  }

  const speaker = voice.speakerId ?? 0;

  return {
    label: voice.name,
    async speak(sentence, outPath, rtf) {
      const parts = chunk(speakable(sentence.text), CHUNK_LIMIT);
      const tailMs = pauseAfter({ kind: sentence.kind, endsSentence: true, rtf });
      return SherpaTts.synthesize(parts, speaker, voice.defaultRate, outPath, SEAM_MS, tailMs);
    },
  };
}

function systemEngine(voiceId: string): SpeechEngine {
  return {
    label: voiceId,
    async speak(sentence, outPath) {
      const started = Date.now();
      // The system engine has no pause control, so the text is handed over
      // whole: it does its own phrasing, and cutting it would only fight that.
      const result = await SystemTts.synthesize(speakable(sentence.text), voiceId, outPath);
      const elapsed = (Date.now() - started) / 1000;
      return {
        ...result,
        rtf: result.durationSec > 0 ? elapsed / result.durationSec : 0,
      };
    },
  };
}
