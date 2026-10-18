import * as StoreReview from 'expo-store-review';
import { getSetting, setSetting, STAT_FINISHED, STAT_LISTENED } from '../db/settings';
import { dayOf, ratingDue, retryLater, surveyDue, type PendingSurvey } from './prompts';
import { appInfo, FEEDBACK_ENDPOINT, send } from './send';
import type { SurveyPayload } from './payload';

/**
 * The questionnaire's and rating prompt's memory, kept in settings.
 *
 * Only that something was asked, answered or put aside -- never what anyone
 * rated, which Play does not tell the app.
 */
const SURVEY_STATE = 'survey.state';
const SURVEY_DAY = 'survey.day';
const SURVEY_PENDING = 'survey.pending';
const RATING_ASKED = 'rating.askedVersion';

/** Whether the questionnaire card should be on the Library now. */
export async function surveyIsDue(): Promise<boolean> {
  const [listened, survey] = await Promise.all([getSetting(STAT_LISTENED), getSetting(SURVEY_STATE)]);
  return surveyDue({
    hasEndpoint: FEEDBACK_ENDPOINT !== '',
    listenedSec: Number(listened) || 0,
    survey,
  });
}

/** The card was shown today, which keeps the rating prompt away until tomorrow. */
export async function noteSurveyShown(): Promise<void> {
  await setSetting(SURVEY_DAY, dayOf(new Date()));
}

export async function dismissSurvey(): Promise<void> {
  await setSetting(SURVEY_STATE, 'dismissed');
}

/**
 * Sends the answers. The card closes either way -- the listener's part is
 * done -- and an answer that could not be sent waits for a later launch.
 */
export async function answerSurvey(payload: SurveyPayload): Promise<void> {
  await setSetting(SURVEY_STATE, 'answered');
  try {
    await send(payload);
  } catch {
    const pending: PendingSurvey = { payload, attempts: 0 };
    await setSetting(SURVEY_PENDING, JSON.stringify(pending));
  }
}

/** Tries an unsent answer again. Once per launch is plenty. */
export async function retryPendingSurvey(): Promise<void> {
  const stored = await getSetting(SURVEY_PENDING);
  if (!stored) return;
  let pending: PendingSurvey;
  try {
    pending = JSON.parse(stored) as PendingSurvey;
  } catch {
    await setSetting(SURVEY_PENDING, '');
    return;
  }
  try {
    await send(pending.payload as object);
    await setSetting(SURVEY_PENDING, '');
  } catch {
    const next = retryLater(pending);
    await setSetting(SURVEY_PENDING, next ? JSON.stringify(next) : '');
  }
}

/**
 * Play's own rating dialog, when it is due.
 *
 * Play decides whether it really appears and never says what was chosen, so
 * this records only that it asked, and a dialog that does not show is not an
 * error.
 */
export async function maybeAskForRating(): Promise<void> {
  const { appVersion } = appInfo();
  const [listened, finished, asked, surveyDay] = await Promise.all([
    getSetting(STAT_LISTENED),
    getSetting(STAT_FINISHED),
    getSetting(RATING_ASKED),
    getSetting(SURVEY_DAY),
  ]);
  const due = ratingDue({
    listenedSec: Number(listened) || 0,
    booksFinished: Number(finished) || 0,
    askedVersion: asked,
    appVersion,
    surveyDay,
    today: dayOf(new Date()),
  });
  if (!due) return;
  await setSetting(RATING_ASKED, appVersion);
  if (await StoreReview.isAvailableAsync().catch(() => false)) {
    await StoreReview.requestReview().catch(() => undefined);
  }
}
