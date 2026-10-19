import { describe, expect, it } from 'vitest';
import { feedbackEmail, feedbackPayload, LIMITS, surveyPayload, voicesPayload } from '../src/feedback/payload';
import { dayOf, ratingDue, retryLater, surveyDue, voiceReportDue } from '../src/feedback/prompts';

const info = { appVersion: '1.1.0', androidVersion: '34' };
const now = new Date('2026-10-18T10:00:00Z');

describe('what the questionnaire sends', () => {
  it('sends the two answers, the comment, and the versions -- nothing else', () => {
    const sent = surveyPayload({ use: 'books', source: 'friend', comment: '  more voices  ' }, info, now);
    expect(sent).toEqual({
      kind: 'survey',
      use: 'books',
      source: 'friend',
      comment: 'more voices',
      appVersion: '1.1.0',
      androidVersion: '34',
      sentAt: '2026-10-18T10:00:00.000Z',
    });
  });

  it('keeps the comment within the limit the server accepts', () => {
    const sent = surveyPayload({ use: 'other', source: 'other', comment: 'x'.repeat(900) }, info, now);
    expect(sent.comment).toHaveLength(LIMITS.comment);
  });
});

describe('what feedback sends', () => {
  const device = { ...info, device: 'realme RMX3031' };

  it('sends the message, the optional email, and the phone', () => {
    expect(feedbackPayload({ message: ' It froze ', email: '' }, device, now)).toMatchObject({
      kind: 'feedback',
      message: 'It froze',
      email: '',
      device: 'realme RMX3031',
    });
  });

  it('sends nothing without a message', () => {
    expect(feedbackPayload({ message: '   ', email: 'a@b.co' }, device, now)).toBeNull();
  });

  it('can go by email instead, with the same details', () => {
    const link = feedbackEmail('It froze', device);
    expect(link.startsWith('mailto:hi@papervoice.app?')).toBe(true);
    expect(decodeURIComponent(link)).toContain('Papervoice 1.1.0 · Android API 34 · realme RMX3031');
  });
});

describe('when to ask', () => {
  it('asks the questionnaire after five minutes of listening, once', () => {
    expect(surveyDue({ hasEndpoint: true, listenedSec: 299, survey: null })).toBe(false);
    expect(surveyDue({ hasEndpoint: true, listenedSec: 300, survey: null })).toBe(true);
    expect(surveyDue({ hasEndpoint: true, listenedSec: 9999, survey: 'answered' })).toBe(false);
    expect(surveyDue({ hasEndpoint: true, listenedSec: 9999, survey: 'dismissed' })).toBe(false);
  });

  it('does not offer the questionnaire when there is nowhere to send it', () => {
    expect(surveyDue({ hasEndpoint: false, listenedSec: 9999, survey: null })).toBe(false);
  });

  const base = {
    listenedSec: 0,
    booksFinished: 0,
    askedVersion: null,
    appVersion: '1.1.0',
    askedDay: null,
    today: '2026-10-18',
  };

  it('asks for a rating after a finished book or an hour of listening', () => {
    expect(ratingDue(base)).toBe(false);
    expect(ratingDue({ ...base, booksFinished: 1 })).toBe(true);
    expect(ratingDue({ ...base, listenedSec: 3600 })).toBe(true);
  });

  it('asks at most once per version, and never the day something else was asked', () => {
    expect(ratingDue({ ...base, booksFinished: 1, askedVersion: '1.1.0' })).toBe(false);
    expect(ratingDue({ ...base, booksFinished: 1, askedVersion: '1.0.1' })).toBe(true);
    expect(ratingDue({ ...base, booksFinished: 1, askedDay: '2026-10-18' })).toBe(false);
    expect(ratingDue({ ...base, booksFinished: 1, askedDay: '2026-10-17' })).toBe(true);
  });

  it('counts days by the local calendar', () => {
    expect(dayOf(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('retries an unsent answer a few times, then lets it go', () => {
    let pending: ReturnType<typeof retryLater> = { payload: {}, attempts: 0 };
    pending = retryLater(pending!);
    pending = retryLater(pending!);
    expect(pending).toEqual({ payload: {}, attempts: 2 });
    expect(retryLater(pending!)).toBeNull();
  });
});

describe('the voice report', () => {
  const totals = { 'system:en-us-x-iob-local': 2040, 'ljspeech-medium': 720, 'manyvoice-4': 540, a: 30, b: 10, c: 5 };

  it('sends the five most listened voices in whole minutes, how many were tried, and the comment', () => {
    const sent = voicesPayload({ totals, comment: '  more Indian voices  ' }, { appVersion: '1.1.0' }, now);
    expect(sent).toEqual({
      kind: 'voices',
      voices: [
        { id: 'system:en-us-x-iob-local', minutes: 34 },
        { id: 'ljspeech-medium', minutes: 12 },
        { id: 'manyvoice-4', minutes: 9 },
        { id: 'a', minutes: 1 },
        { id: 'b', minutes: 0 },
      ],
      tried: 6,
      comment: 'more Indian voices',
      appVersion: '1.1.0',
      sentAt: '2026-10-18T10:00:00.000Z',
    });
  });

  it('keeps the comment within the limit the server accepts', () => {
    const sent = voicesPayload({ totals, comment: 'x'.repeat(900) }, { appVersion: '1.1.0' }, now);
    expect(sent.comment).toHaveLength(LIMITS.comment);
  });

  const state = { hasEndpoint: true, listenedSec: 3600, report: null, askedToday: false };

  it('asks after an hour of listening counted by voice, once', () => {
    expect(voiceReportDue({ ...state, listenedSec: 3599 })).toBe(false);
    expect(voiceReportDue(state)).toBe(true);
    expect(voiceReportDue({ ...state, report: 'answered' })).toBe(false);
    expect(voiceReportDue({ ...state, report: 'dismissed' })).toBe(false);
  });

  it('never without somewhere to send it, nor on a day something else was asked', () => {
    expect(voiceReportDue({ ...state, hasEndpoint: false })).toBe(false);
    expect(voiceReportDue({ ...state, askedToday: true })).toBe(false);
  });
});

