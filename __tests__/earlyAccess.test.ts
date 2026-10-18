import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { surveyPayload, feedbackPayload } from '../src/feedback/payload';

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
