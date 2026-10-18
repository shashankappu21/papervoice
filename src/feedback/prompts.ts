/**
 * When to ask anything, decided in one place.
 *
 * The rule throughout: ask only after real listening, never during it, never
 * twice the same day, and take "no" for an answer.
 */

/** Listening before the questionnaire appears. */
export const SURVEY_AFTER_SEC = 5 * 60;
/** Listening before Play's rating prompt, when no book has been finished. */
export const RATING_AFTER_SEC = 60 * 60;

/** Local calendar day, so "the same day" means the listener's day. */
export const dayOf = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function surveyDue(state: {
  /** Nowhere to send it: the questionnaire is not offered at all. */
  hasEndpoint: boolean;
  listenedSec: number;
  /** answered · dismissed · null */
  survey: string | null;
}): boolean {
  return state.hasEndpoint && state.survey === null && state.listenedSec >= SURVEY_AFTER_SEC;
}

export function ratingDue(state: {
  listenedSec: number;
  booksFinished: number;
  /** The app version the prompt was last shown in, if ever. */
  askedVersion: string | null;
  appVersion: string;
  /** The day the questionnaire was shown, if ever. */
  surveyDay: string | null;
  today: string;
}): boolean {
  if (state.askedVersion === state.appVersion) return false;
  if (state.surveyDay === state.today) return false;
  return state.booksFinished > 0 || state.listenedSec >= RATING_AFTER_SEC;
}

/** An answer that could not be sent, kept to try again on later launches. */
export interface PendingSurvey {
  payload: unknown;
  attempts: number;
}

export const SURVEY_RETRIES = 3;

export function retryLater(pending: PendingSurvey): PendingSurvey | null {
  const attempts = pending.attempts + 1;
  return attempts >= SURVEY_RETRIES ? null : { ...pending, attempts };
}
