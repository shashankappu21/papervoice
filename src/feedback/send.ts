import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { AppInfo } from './payload';

/**
 * Where answers and feedback go: the same Apps Script web app as the site's
 * beta form, which writes them to a Google Sheet only the developer can see.
 *
 * Read from EXPO_PUBLIC_FEEDBACK_ENDPOINT in the local, git-ignored .env and
 * inlined at build time -- never written into the repository. Empty when it
 * is not set, and then nothing is ever sent: the questionnaire is not offered
 * and feedback goes by email.
 *
 * Dot notation, deliberately: Expo inlines only `process.env.EXPO_PUBLIC_X`
 * written out in full.
 */
export const FEEDBACK_ENDPOINT: string = process.env.EXPO_PUBLIC_FEEDBACK_ENDPOINT ?? '';

export function appInfo(): AppInfo {
  return {
    appVersion: Constants.expoConfig?.version ?? 'unknown',
    androidVersion: String(Platform.Version),
  };
}

export function deviceName(): string {
  const constants = Platform.constants as { Brand?: string; Model?: string };
  return [constants.Brand, constants.Model].filter(Boolean).join(' ') || 'unknown';
}

/**
 * Posts one message. Throws unless the script answers `{ ok: true }`.
 *
 * As text/plain, like the site's form: any other content type makes a
 * preflight that an Apps Script web app does not answer.
 */
export async function send(payload: object): Promise<void> {
  if (!FEEDBACK_ENDPOINT) throw new Error('Nowhere to send it.');
  const response = await fetch(FEEDBACK_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  const reply = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!response.ok || !reply?.ok) throw new Error(reply?.error ?? `HTTP ${response.status}`);
}
