import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { surveyPayload, feedbackPayload, voicesPayload } from '../src/feedback/payload';

/*
 * The Apps Script itself, run in Node with Google's services stubbed, so the
 * checks it makes are the ones tested -- and so a change to what the app sends
 * that the script would refuse fails here, not silently on a phone.
 */
function loadScript() {
  const rows: Record<string, unknown[][]> = {};
  const sheet = (name: string) => ({
    getLastRow: () => (rows[name] ?? []).length,
    appendRow: (row: unknown[]) => {
      (rows[name] ??= []).push(row);
    },
    setFrozenRows: () => undefined,
    getRange: () => ({ getValues: () => (rows[name] ?? []).slice(1).map((r) => [r[1]]) }),
  });
  const globals = {
    ContentService: {
      createTextOutput: (text: string) => ({ setMimeType: () => JSON.parse(text) }),
      MimeType: { JSON: 'json' },
    },
    LockService: { getScriptLock: () => ({ waitLock: () => undefined, releaseLock: () => undefined }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (name: string) => (rows[name] ? sheet(name) : null),
        insertSheet: (name: string) => {
          rows[name] = [];
          return sheet(name);
        },
      }),
    },
  };
  const source = readFileSync(new URL('../early-access/Code.gs', import.meta.url), 'utf8');
  const script = new Function(
    ...Object.keys(globals),
    `${source}\nreturn { doPost: doPost, plain: plain };`,
  )(...Object.values(globals)) as {
    doPost: (e: { postData: { contents: string } }) => { ok: boolean; error?: string };
    plain: (value: string) => string;
  };
  const post = (body: unknown) => script.doPost({ postData: { contents: JSON.stringify(body) } });
  return { post, rows, plain: script.plain };
}

const info = { appVersion: '1.1.0', androidVersion: '34' };

describe('the Apps Script behind the questionnaire and feedback', () => {
  it('accepts exactly what the app sends, into its own tab', () => {
    const { post, rows } = loadScript();
    expect(post(surveyPayload({ use: 'books', source: 'friend', comment: 'more voices' }, info))).toEqual({ ok: true });
    expect(
      post(feedbackPayload({ message: 'It froze', email: 'a@b.co' }, { ...info, device: 'realme RMX3031' })),
    ).toEqual({ ok: true });
    expect(rows.survey).toHaveLength(2);
    expect(rows.survey[1].slice(1, 6)).toEqual(['books', 'friend', 'more voices', '1.1.0', '34']);
    expect(rows.feedback[1].slice(1, 6)).toEqual(['It froze', 'a@b.co', '1.1.0', '34', 'realme RMX3031']);
  });

  it('refuses answers that are not on the app\'s lists', () => {
    const { post, rows } = loadScript();
    expect(post({ kind: 'survey', use: 'spam', source: 'friend', comment: '', ...info }).ok).toBe(false);
    expect(post({ kind: 'nonsense', ...info }).ok).toBe(false);
    expect(rows.survey).toBeUndefined();
  });

  it('refuses oversized requests and fields', () => {
    const { post } = loadScript();
    expect(post({ kind: 'feedback', message: 'x'.repeat(5000), email: '', ...info }).ok).toBe(false);
    expect(post({ kind: 'feedback', message: 'hi', email: 'not an email', ...info }).ok).toBe(false);
  });

  it('never lets a message become a formula', () => {
    const { plain } = loadScript();
    expect(plain('=HYPERLINK("x")')).toBe('\'=HYPERLINK("x")');
    expect(plain('-1')).toBe("'-1");
    expect(plain('fine')).toBe('fine');
  });

  it('still takes the site\'s early-access signups as before', () => {
    const { post, rows } = loadScript();
    expect(post({ email: 'reader@example.com', timestamp: 't' })).toEqual({ ok: true });
    expect(rows.signups[1][1]).toBe('reader@example.com');
  });
});

describe('the Apps Script behind the voice report', () => {
  const totals = { 'system:en-us-x-iob-local': 2040, 'ljspeech-medium': 720 };

  it('accepts exactly what the app sends, into a voices tab', () => {
    const { post, rows } = loadScript();
    expect(post(voicesPayload({ totals, comment: 'Ava is lovely' }, { appVersion: '1.1.0' }))).toEqual({ ok: true });
    expect(rows.voices[0].slice(0, 6)).toEqual(['received_at', 'voices', 'tried', 'comment', 'app_version', 'sent_at']);
    expect(rows.voices[1].slice(1, 5)).toEqual([
      'system:en-us-x-iob-local:34, ljspeech-medium:12',
      2,
      'Ava is lovely',
      '1.1.0',
    ]);
  });

  it('refuses more than five voices, odd ids and impossible minutes', () => {
    const { post } = loadScript();
    const sent = voicesPayload({ totals, comment: '' }, { appVersion: '1.1.0' });
    const six = Array.from({ length: 6 }, (_, i) => ({ id: `manyvoice-${i}`, minutes: 1 }));
    expect(post({ ...sent, voices: six }).ok).toBe(false);
    expect(post({ ...sent, voices: [{ id: 'bad id!', minutes: 1 }] }).ok).toBe(false);
    expect(post({ ...sent, voices: [{ id: 'ljspeech-medium', minutes: -1 }] }).ok).toBe(false);
    expect(post({ ...sent, voices: [{ id: 'ljspeech-medium', minutes: 1.5 }] }).ok).toBe(false);
    expect(post({ ...sent, tried: 'many' }).ok).toBe(false);
    expect(post({ ...sent, comment: 'x'.repeat(501) }).ok).toBe(false);
  });

  it('never lets the comment become a formula', () => {
    const { post, rows } = loadScript();
    post(voicesPayload({ totals, comment: '=IMPORTXML("x")' }, { appVersion: '1.1.0' }));
    expect(rows.voices[1][3]).toBe('\'=IMPORTXML("x")');
  });
});
