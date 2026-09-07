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
  try {
    const [language, region] = voice.locale.split('-');
    const languages = new Intl.DisplayNames(['en'], { type: 'language' });
    const regions = region ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
    const place = regions && region ? ` (${regions.of(region.toUpperCase())})` : '';
    return `${languages.of(language)}${place}`;
  } catch {
    return voice.locale || voice.id;
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

/** Prepares whichever engine the chosen voice belongs to. */
export async function openEngine(chosenId: string | null): Promise<SpeechEngine> {
  if (chosenId && isSystemVoice(chosenId)) {
    return systemEngine(chosenId.slice(SYSTEM_PREFIX.length));
  }

  const store = voiceStore();
  const voice =
    (chosenId ? findVoice(chosenId) : undefined) ??
    VOICES.find((candidate) => store.isInstalled(candidate));

  if (voice && store.isInstalled(voice)) return neuralEngine(voice);

  // Nothing downloaded: fall back to the phone's own voice rather than refusing
  // to read, which is the whole point of having a floor.
  const { usable } = await listUsableSystemVoices();
  if (usable.length === 0) {
    throw new Error('This phone has no offline voice, and no voice has been downloaded yet.');
  }
  return systemEngine(usable[0].id);
}

async function neuralEngine(voice: VoiceMeta): Promise<SpeechEngine> {
  const paths = await voiceLoadPaths(voice);
  await SherpaTts.load(paths.model, paths.tokens, paths.dataDir, 2);

  return {
    label: voice.name,
    async speak(sentence, outPath, rtf) {
      const parts = chunk(speakable(sentence.text), CHUNK_LIMIT);
      const tailMs = pauseAfter({ kind: sentence.kind, endsSentence: true, rtf });
      return SherpaTts.synthesize(parts, 0, voice.defaultRate, outPath, SEAM_MS, tailMs);
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
