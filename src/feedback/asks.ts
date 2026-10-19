import * as StoreReview from 'expo-store-review';
import { getSetting, setSetting, STAT_FINISHED, STAT_LISTENED, STAT_LISTENED_BY_VOICE } from '../db/settings';
import { listenedAcrossVoices } from '../stats/listening';
import { dayOf, ratingDue, retryLater, surveyDue, voiceReportDue, type PendingSurvey } from './prompts';
import { appInfo, FEEDBACK_ENDPOINT, send, SURVEY_PREVIEW } from './send';
import type { SurveyPayload, VoicesPayload } from './payload';

/**
 * The questionnaire's, voice report's and rating prompt's memory, kept in
 * settings.
 *
 * Only that something was asked, answered or put aside -- never what anyone
 * rated, which Play does not tell the app.
 */
const SURVEY_STATE = 'survey.state';
/** The day the questionnaire was shown. Read still, for installs from before ASKED_DAY. */
const SURVEY_DAY = 'survey.day';
const SURVEY_PENDING = 'survey.pending';
const REPORT_STATE = 'voiceReport.state';
const REPORT_PENDING = 'voiceReport.pending';
/** The last day anything was asked -- questionnaire, voice report or rating. One a day. */
const ASKED_DAY = 'asks.day';
const RATING_ASKED = 'rating.askedVersion';

/**
 * A preview build shows the questionnaire once per launch, then the voice
 * report the next time the Library comes into view; see SURVEY_PREVIEW.
 */
let previewed = false;
let reportPreviewed = false;

async function askedToday(): Promise<boolean> {
  const today = dayOf(new Date());
  const [surveyDay, askedDay] = await Promise.all([getSetting(SURVEY_DAY), getSetting(ASKED_DAY)]);
  return surveyDay === today || askedDay === today;
}

/** Something was put in front of the listener today: nothing else is, until tomorrow. */
async function noteAsked(): Promise<void> {
  if (SURVEY_PREVIEW) return;
  await setSetting(ASKED_DAY, dayOf(new Date()));
}

/** Sends a message, or keeps it to try again on a later launch. */
async function sendOrKeep(payload: object, pendingKey: string): Promise<void> {
  try {
    await send(payload);
  } catch {
    const pending: PendingSurvey = { payload, attempts: 0 };
    await setSetting(pendingKey, JSON.stringify(pending));
  }
}

/** Tries an unsent message again. Once per launch is plenty. */
async function retryPending(pendingKey: string): Promise<void> {
  const stored = await getSetting(pendingKey);
  if (!stored) return;
  let pending: PendingSurvey;
  try {
    pending = JSON.parse(stored) as PendingSurvey;
  } catch {
    await setSetting(pendingKey, '');
    return;
  }
  try {
    await send(pending.payload as object);
    await setSetting(pendingKey, '');
  } catch {
    const next = retryLater(pending);
    await setSetting(pendingKey, next ? JSON.stringify(next) : '');
  }
}

/** Whether the questionnaire should slide up over the Library now. */
export async function surveyIsDue(): Promise<boolean> {
  if (SURVEY_PREVIEW) {
    const due = !previewed;
    previewed = true;
    return due;
  }
  const [listened, survey] = await Promise.all([getSetting(STAT_LISTENED), getSetting(SURVEY_STATE)]);
  return surveyDue({
    hasEndpoint: FEEDBACK_ENDPOINT !== '',
    listenedSec: Number(listened) || 0,
    survey,
  });
}

/** It was shown today, which keeps the other asks away until tomorrow. */
export async function noteSurveyShown(): Promise<void> {
  await noteAsked();
}

export async function dismissSurvey(): Promise<void> {
  if (SURVEY_PREVIEW) return;
  await setSetting(SURVEY_STATE, 'dismissed');
}

/**
 * Sends the answers. The card closes either way -- the listener's part is
 * done -- and an answer that could not be sent waits for a later launch.
 */
export async function answerSurvey(payload: SurveyPayload): Promise<void> {
  if (SURVEY_PREVIEW) return;
  await setSetting(SURVEY_STATE, 'answered');
  await sendOrKeep(payload, SURVEY_PENDING);
}

/** Tries unsent answers again: the questionnaire's and the voice report's. */
export async function retryPendingSurvey(): Promise<void> {
  await retryPending(SURVEY_PENDING);
  await retryPending(REPORT_PENDING);
}

/** Seconds listened per voice, counted from 1.1. */
export async function listenedByVoice(): Promise<Record<string, number>> {
  try {
    const stored = await getSetting(STAT_LISTENED_BY_VOICE);
    const parsed: unknown = stored ? JSON.parse(stored) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** Whether the voice report should slide up over the Library now. */
export async function voiceReportIsDue(): Promise<boolean> {
  if (SURVEY_PREVIEW) {
    // After the questionnaire's turn, so each gets its own look.
    const due = previewed && !reportPreviewed;
    if (due) reportPreviewed = true;
    return due;
  }
  const [byVoice, report, asked] = await Promise.all([
    listenedByVoice(),
    getSetting(REPORT_STATE),
    askedToday(),
  ]);
  return voiceReportDue({
    hasEndpoint: FEEDBACK_ENDPOINT !== '',
    listenedSec: listenedAcrossVoices(byVoice),
    report,
    askedToday: asked,
  });
}

export async function noteVoiceReportShown(): Promise<void> {
  await noteAsked();
}

export async function dismissVoiceReport(): Promise<void> {
  if (SURVEY_PREVIEW) return;
  await setSetting(REPORT_STATE, 'dismissed');
}

/** Sends the report; it closes either way, and an unsent one waits for a later launch. */
export async function answerVoiceReport(payload: VoicesPayload): Promise<void> {
  if (SURVEY_PREVIEW) return;
  await setSetting(REPORT_STATE, 'answered');
  await sendOrKeep(payload, REPORT_PENDING);
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
  const today = dayOf(new Date());
  const [listened, finished, asked, surveyDay, askedDay] = await Promise.all([
    getSetting(STAT_LISTENED),
    getSetting(STAT_FINISHED),
    getSetting(RATING_ASKED),
    getSetting(SURVEY_DAY),
    getSetting(ASKED_DAY),
  ]);
  const due = ratingDue({
    listenedSec: Number(listened) || 0,
    booksFinished: Number(finished) || 0,
    askedVersion: asked,
    appVersion,
    askedDay: surveyDay === today ? surveyDay : askedDay,
    today,
  });
  if (!due) return;
  await setSetting(RATING_ASKED, appVersion);
  await noteAsked();
  if (await StoreReview.isAvailableAsync().catch(() => false)) {
    await StoreReview.requestReview().catch(() => undefined);
  }
}
