import { isLanguageAlias, type PhoneVoiceName } from './order';

/**
 * Whether a phone voice is really on the phone before it is used.
 *
 * Google lists every voice of a language but downloads a language's voices
 * only when one is first used, and until the download is in it speaks with
 * another voice -- under the name that was asked for. Seen on a Redmi Note 8
 * Pro, 2026-10-24: eight sentences asked for as Nigerian English came out as
 * the American default voice, then the pack arrived and the real one spoke.
 * Android flags such a voice (KEY_FEATURE_NOT_INSTALLED), so a voice that
 * carries the flag is never spoken with: its download is started and it is
 * waited for.
 *
 * Pure, with the engine passed in, so the waiting is tested.
 */

/** How often to ask again whether the download is in. */
export const CHECK_EVERY_MS = 3_000;
/** How long to wait before saying it did not come. A pack is about 15 MB. */
export const GIVE_UP_AFTER_MS = 120_000;

export class VoiceNotReadyError extends Error {
  constructor() {
    super(
      'This voice is still downloading. Connect to Wi-Fi, or download it in Settings > Text-to-speech > Install voice data.',
    );
    this.name = 'VoiceNotReadyError';
  }
}

export interface ReadinessDeps {
  isReady(voiceId: string): Promise<boolean>;
  /** Starts the engine's download of the voice; nothing it makes is kept. */
  fetch(voiceId: string): Promise<void>;
  sleep(ms: number): Promise<void>;
  now(): number;
  onWaiting?(voiceId: string): void;
  onReady?(voiceId: string): void;
}

/** 'ready' when it already was; 'downloaded' when it had to be waited for. Throws VoiceNotReadyError. */
export async function ensureReady(voiceId: string, deps: ReadinessDeps): Promise<'ready' | 'downloaded'> {
  if (await deps.isReady(voiceId)) return 'ready';

  deps.onWaiting?.(voiceId);
  try {
    await deps.fetch(voiceId);
  } catch {
    // Asking is all that is needed; the waiting below says whether it worked.
  }
  const started = deps.now();
  while (deps.now() - started < GIVE_UP_AFTER_MS) {
    await deps.sleep(CHECK_EVERY_MS);
    if (await deps.isReady(voiceId)) {
      deps.onReady?.(voiceId);
      return 'downloaded';
    }
  }
  throw new VoiceNotReadyError();
}

/**
 * The voices to use, once each, to start the downloads of the packs our named
 * voices are in. A pack holds a whole language, so one voice per language is
 * enough; Google's per-language aliases are never used.
 */
export function voicesToPrefetch(
  voices: Array<{ id: string; locale: string; notInstalled?: boolean }>,
  named: Record<string, PhoneVoiceName>,
): string[] {
  const byLocale = new Map<string, string>();
  for (const voice of [...voices].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!voice.notInstalled || isLanguageAlias(voice.id) || !named[voice.id]) continue;
    if (!byLocale.has(voice.locale)) byLocale.set(voice.locale, voice.id);
  }
  return [...byLocale.values()];
}
