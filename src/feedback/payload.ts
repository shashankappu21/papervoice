import { topVoices, voicesTried } from '../stats/listening';

/**
 * What the questionnaire, the voice report and feedback send, and nothing more.
 *
 * The lists and limits here are the same ones the Apps Script checks
 * (early-access/Code.gs), so anything the app sends is accepted and anything
 * else posted to the endpoint is refused.
 */

export const USES = {
  study: 'Study or work documents',
  books: 'Books and stories',
  articles: 'Articles',
  access: 'I find reading hard (eyesight, dyslexia)',
  other: 'Something else',
} as const;

export const SOURCES = {
  friend: 'A friend',
  play: 'Play Store search',
  site: 'papervoice.app',
  social: 'Social media',
  testers: 'A testers group',
  other: 'Something else',
} as const;

export type Use = keyof typeof USES;
export type Source = keyof typeof SOURCES;

export const LIMITS = { comment: 500, message: 2000, email: 254 } as const;

/** What every message carries about the app, so a report can be placed. */
export interface AppInfo {
  appVersion: string;
  /** Android's API level, e.g. "34". */
  androidVersion: string;
}

export interface SurveyPayload extends AppInfo {
  kind: 'survey';
  use: Use;
  source: Source;
  comment: string;
  sentAt: string;
}

export interface FeedbackPayload extends AppInfo {
  kind: 'feedback';
  message: string;
  email: string;
  /** "Brand Model", so a report can be matched to the phone it came from. */
  device: string;
  sentAt: string;
}

/**
 * The voice report: which voices someone stays with, by id and whole minutes,
 * and anything they want to say about voices. No Android version or device --
 * it is about the voices, not the phone.
 */
export interface VoicesPayload {
  kind: 'voices';
  voices: Array<{ id: string; minutes: number }>;
  /** How many voices were listened to at all. */
  tried: number;
  comment: string;
  appVersion: string;
  sentAt: string;
}

/** At most this many voices go in a report; the Apps Script refuses more. */
export const REPORT_VOICES = 5;

const clip = (text: string, limit: number) => text.trim().slice(0, limit);

export function voicesPayload(
  input: { totals: Record<string, number>; comment: string },
  info: { appVersion: string },
  now = new Date(),
): VoicesPayload {
  return {
    kind: 'voices',
    voices: topVoices(input.totals, REPORT_VOICES).map(({ id, seconds }) => ({
      id,
      minutes: Math.round(seconds / 60),
    })),
    tried: voicesTried(input.totals),
    comment: clip(input.comment, LIMITS.comment),
    appVersion: info.appVersion,
    sentAt: now.toISOString(),
  };
}

export function surveyPayload(
  answers: { use: Use; source: Source; comment: string },
  info: AppInfo,
  now = new Date(),
): SurveyPayload {
  return {
    kind: 'survey',
    use: answers.use,
    source: answers.source,
    comment: clip(answers.comment, LIMITS.comment),
    ...info,
    sentAt: now.toISOString(),
  };
}

/** Null when there is no message: an empty report is not worth sending. */
export function feedbackPayload(
  input: { message: string; email: string },
  info: AppInfo & { device: string },
  now = new Date(),
): FeedbackPayload | null {
  const message = clip(input.message, LIMITS.message);
  if (!message) return null;
  return {
    kind: 'feedback',
    message,
    email: clip(input.email, LIMITS.email),
    ...info,
    sentAt: now.toISOString(),
  };
}

/** The same report, for the person's own mail app when sending fails or isn't set up. */
export function feedbackEmail(message: string, info: AppInfo & { device: string }): string {
  const body = `${message.trim()}\n\n--\nPapervoice ${info.appVersion} · Android API ${info.androidVersion} · ${info.device}`;
  return `mailto:hi@papervoice.app?subject=${encodeURIComponent('Papervoice feedback')}&body=${encodeURIComponent(body)}`;
}
