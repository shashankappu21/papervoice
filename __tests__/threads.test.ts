import { describe, expect, it } from 'vitest';
import { DEFAULT_THREADS, THREAD_CHOICES, parseThreads } from '../src/voices/threads';

describe('the inference thread setting', () => {
  it('takes each of the offered choices as it is', () => {
    for (const value of THREAD_CHOICES) {
      expect(parseThreads(String(value))).toBe(value);
    }
  });

  it('defaults to what has always shipped when nothing is stored', () => {
    expect(DEFAULT_THREADS).toBe(2);
    expect(parseThreads(null)).toBe(2);
    expect(parseThreads(undefined)).toBe(2);
    expect(parseThreads('')).toBe(2);
  });

  it('falls back to the default rather than trusting anything unexpected', () => {
    // A bad developer setting must never be the reason a book will not read.
    for (const stored of ['0', '3', '8', '-1', '2.5', 'four', 'NaN', '1e9']) {
      expect(parseThreads(stored)).toBe(DEFAULT_THREADS);
    }
  });
});
