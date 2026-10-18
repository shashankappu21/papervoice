/**
 * What the questionnaire and feedback send, and nothing more.
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

const clip = (text: string, limit: number) => text.trim().slice(0, limit);

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
