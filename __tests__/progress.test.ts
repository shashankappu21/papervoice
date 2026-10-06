import { describe, expect, it } from 'vitest';
import {
  isFinished,
  isInProgress,
  progressLabel,
  resumeIndex,
} from '../src/library/progress';

const book = (position: number, finishedAt: number | null = null) => ({
  position,
  sentenceCount: 100,
  finishedAt,
});

describe('a book that has never been finished', () => {
  it('is in progress once started, and resumes where it stopped', () => {
    expect(isInProgress(book(40))).toBe(true);
    expect(resumeIndex(book(40))).toBe(40);
    expect(progressLabel(book(40))).toBe('40% · ');
  });

  it('is not in progress before it has been started', () => {
    expect(isInProgress(book(0))).toBe(false);
    expect(progressLabel(book(0))).toBe('');
  });

  it('sitting on its last sentence is not finished until it has actually ended', () => {
    // Paused on the final sentence is still mid-book.
    expect(isFinished(book(99))).toBe(false);
    expect(isInProgress(book(99))).toBe(true);
    expect(resumeIndex(book(99))).toBe(99);
  });
});

describe('a finished book', () => {
  it('leaves Continue listening, says so, and reopens at the start', () => {
    const done = book(0, 1_700_000_000_000);
    expect(isFinished(done)).toBe(true);
    expect(isInProgress(done)).toBe(false);
    expect(resumeIndex(done)).toBe(0);
    expect(progressLabel(done)).toBe('Finished · ');
  });

  it('stays finished when the position timer wrote the last sentence back', () => {
    // The race: the five-second save lands after the finish and stores the
    // final sentence. Still finished, still opens at the start.
    const raced = book(99, 1_700_000_000_000);
    expect(isFinished(raced)).toBe(true);
    expect(isInProgress(raced)).toBe(false);
    expect(resumeIndex(raced)).toBe(0);
  });

  it('comes back to Continue listening once started again', () => {
    const again = book(12, 1_700_000_000_000);
    expect(isFinished(again)).toBe(false);
    expect(isInProgress(again)).toBe(true);
    expect(resumeIndex(again)).toBe(12);
    expect(progressLabel(again)).toBe('12% · ');
  });
});
