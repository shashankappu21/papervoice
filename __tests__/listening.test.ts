import { describe, expect, it } from 'vitest';
import {
  add,
  addForVoice,
  dueForWrite,
  flush,
  flushVoices,
  listenedAcrossVoices,
  playedBetween,
  topVoices,
  total,
  voicesDueForWrite,
  voicesTried,
  type VoiceCounter,
} from '../src/stats/listening';

describe('counting listening time', () => {
  it('counts the time between two playing reports', () => {
    expect(playedBetween(1_000, 1_500)).toBe(0.5);
  });

  it('counts nothing for the first report of a stretch', () => {
    expect(playedBetween(null, 1_500)).toBe(0);
  });

  it('does not count a long gap, such as the phone sleeping', () => {
    expect(playedBetween(1_000, 61_000)).toBe(0);
    expect(playedBetween(5_000, 1_000)).toBe(0);
  });

  it('writes only every half minute, and keeps the total exact', () => {
    let counter = { stored: 100, pending: 0 };
    counter = add(counter, 20);
    expect(dueForWrite(counter)).toBe(false);
    counter = add(counter, 12);
    expect(dueForWrite(counter)).toBe(true);
    expect(total(counter)).toBe(132);

    const written = flush(counter);
    expect(written.total).toBe(132);
    expect(written.counter).toEqual({ stored: 132, pending: 0 });
  });
});

describe('listening per voice', () => {
  const empty: VoiceCounter = { stored: {}, pending: {} };

  it('adds seconds to the voice that was reading', () => {
    let counter = addForVoice(empty, 'ljspeech-medium', 1.5);
    counter = addForVoice(counter, 'ljspeech-medium', 1);
    counter = addForVoice(counter, 'system:en-us-x-iob-local', 2);
    expect(counter.pending).toEqual({ 'ljspeech-medium': 2.5, 'system:en-us-x-iob-local': 2 });
  });

  it('ignores negative time, as the total does', () => {
    expect(addForVoice(empty, 'x', -3).pending).toEqual({});
  });

  it('writes whole seconds, keeping what was stored', () => {
    const counter = addForVoice({ stored: { a: 100 }, pending: {} }, 'a', 10.4);
    const written = flushVoices(addForVoice(counter, 'b', 3.6));
    expect(written.totals).toEqual({ a: 110, b: 4 });
    expect(written.counter).toEqual({ stored: { a: 110, b: 4 }, pending: {} });
  });

  it('is due for writing on the same half minute as the total', () => {
    expect(voicesDueForWrite(addForVoice(empty, 'a', 29))).toBe(false);
    expect(voicesDueForWrite(addForVoice(addForVoice(empty, 'a', 20), 'b', 10))).toBe(true);
  });

  it('lists the most listened first, ties by id, and counts what was tried', () => {
    const totals = { b: 600, a: 600, c: 1200, d: 0 };
    expect(topVoices(totals, 2)).toEqual([
      { id: 'c', seconds: 1200 },
      { id: 'a', seconds: 600 },
    ]);
    expect(voicesTried(totals)).toBe(3);
    expect(listenedAcrossVoices({ ...totals, e: 30 })).toBe(2430);
  });
});
