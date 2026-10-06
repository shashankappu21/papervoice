import { database } from './connection';

/**
 * Preferences that belong to the reader rather than to any one book.
 *
 * Reading speed is the clearest example: someone who listens at 1.6x listens at
 * 1.6x to everything, and having to set it again for each book -- and again
 * after every restart -- is the sort of small forgetfulness that makes an app
 * feel careless.
 */
export async function getSetting(key: string): Promise<string | null> {
  const db = await database();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await database();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}

export const SETTING_RATE = 'playback.rate';
export const SETTING_VOICE = 'playback.voice';
export const SETTING_THEME = 'reader.theme';
export const SETTING_FONT_SIZE = 'reader.fontSize';
/** Developer setting: inference threads for the neural engine. See voices/threads.ts. */
export const SETTING_THREADS = 'dev.inferenceThreads';
