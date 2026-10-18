import { describe, expect, it } from 'vitest';
import {
  FADE_SECONDS,
  nextChapterStart,
  sleepLabel,
  startChapter,
  startMinutes,
  tick,
} from '../src/player/sleepTimer';

const sections = [
  { title: 'The Gift of the Magi', index: 3, depth: 0 },
  { title: 'Part two', index: 40, depth: 1 },
  { title: 'The Last Leaf', index: 120, depth: 0 },
  { title: 'The Ransom of Red Chief', index: 260, depth: 0 },
];

describe('a minutes sleep timer', () => {
  it('counts down by the seconds actually played', () => {
    const after = tick(startMinutes(15), 30);
    expect(after.timer).toEqual({ kind: 'minutes', leftSec: 15 * 60 - 30 });
    expect(after.stop).toBe(false);
    expect(after.volume).toBe(1);
  });

  it('does not move while nothing is played', () => {
    expect(tick(startMinutes(15), 0).timer).toEqual({ kind: 'minutes', leftSec: 900 });
  });

  it('fades over the last seconds instead of cutting off', () => {
    const fading = tick({ kind: 'minutes', leftSec: FADE_SECONDS }, FADE_SECONDS / 2);
    expect(fading.volume).toBeCloseTo(0.5);
    expect(fading.stop).toBe(false);
  });

  it('stops, silent, when it runs out, and clears itself', () => {
    expect(tick({ kind: 'minutes', leftSec: 1 }, 2)).toEqual({ timer: null, volume: 0, stop: true });
  });

  it('reads in whole minutes, never "0 min" while playing', () => {
    expect(sleepLabel(startMinutes(30))).toBe('30 min');
    expect(sleepLabel({ kind: 'minutes', leftSec: 61 })).toBe('2 min');
    expect(sleepLabel({ kind: 'minutes', leftSec: 4 })).toBe('1 min');
    expect(sleepLabel(null)).toBeNull();
  });
});

describe('an end-of-chapter sleep timer', () => {
  it('stops before the next chapter begins', () => {
    expect(startChapter(sections, 50)).toEqual({ kind: 'chapter', stopBefore: 120 });
  });

  it('ignores sub-sections inside the chapter being read', () => {
    expect(nextChapterStart(sections, 10)).toBe(120);
  });

  it('lets the book end on its own in the last chapter', () => {
    expect(startChapter(sections, 300)).toEqual({ kind: 'chapter', stopBefore: null });
  });

  it('is not moved by time', () => {
    const timer = startChapter(sections, 50);
    expect(tick(timer, 600)).toEqual({ timer, volume: 1, stop: false });
    expect(sleepLabel(timer)).toBe('End of chapter');
  });
});
