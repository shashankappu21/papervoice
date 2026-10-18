import { describe, expect, it } from 'vitest';
import { afterFailure, shouldImport, showsStartHere } from '../src/import/starter';

describe('the starter book', () => {
  it('is imported on a fresh install', () => {
    expect(shouldImport('pending')).toBe(true);
  });

  it('is never added to a library that existed before, or once done', () => {
    expect(shouldImport(null)).toBe(false);
    expect(shouldImport('done')).toBe(false);
  });

  it('is retried after a failure, three times in all, then left alone', () => {
    let state = afterFailure('pending');
    expect(state).toBe('failed:1');
    expect(shouldImport(state)).toBe(true);
    state = afterFailure(state);
    expect(state).toBe('failed:2');
    expect(shouldImport(state)).toBe(true);
    state = afterFailure(state);
    expect(state).toBe('gave-up');
    expect(shouldImport(state)).toBe(false);
  });

  it('says Start here until it is first opened', () => {
    const book = { id: 4, addedAt: 100, lastOpenedAt: 100 };
    expect(showsStartHere(book, 4)).toBe(true);
    expect(showsStartHere({ ...book, lastOpenedAt: 250 }, 4)).toBe(false);
    expect(showsStartHere(book, 9)).toBe(false);
    expect(showsStartHere(book, null)).toBe(false);
  });
});
