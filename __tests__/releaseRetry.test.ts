import { describe, expect, it, vi } from 'vitest';
// @ts-ignore -- plain .mjs
import { retrying } from '../scripts/release/github.mjs';

const dropped = () => new TypeError('fetch failed', { cause: { code: 'ECONNABORTED' } });
const http = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });
const quick = { wait: 0 };

describe('retrying a release call', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  it('tries again when the connection drops, as it did for 1.0.1', async () => {
    const attempt = vi.fn().mockRejectedValueOnce(dropped()).mockResolvedValue('draft');
    expect(await retrying('creating v1', attempt, undefined, quick)).toBe('draft');
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('tries again when GitHub is busy', async () => {
    const attempt = vi.fn().mockRejectedValueOnce(http(502)).mockResolvedValue('ok');
    expect(await retrying('x', attempt, undefined, quick)).toBe('ok');
  });

  it('does not retry an answer, such as the tag already existing', async () => {
    const attempt = vi.fn().mockRejectedValue(http(422));
    await expect(retrying('x', attempt, undefined, quick)).rejects.toThrow('HTTP 422');
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('uses what the lost attempt made instead of making it twice', async () => {
    const attempt = vi.fn().mockRejectedValue(dropped());
    const recover = vi.fn().mockResolvedValue('the draft that was made');
    expect(await retrying('x', attempt, recover, quick)).toBe('the draft that was made');
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('retries when the lost attempt made nothing', async () => {
    const attempt = vi.fn().mockRejectedValueOnce(dropped()).mockResolvedValue('made now');
    const recover = vi.fn().mockResolvedValue(null);
    expect(await retrying('x', attempt, recover, quick)).toBe('made now');
    expect(recover).toHaveBeenCalledTimes(1);
  });

  it('gives up after four tries with the real error', async () => {
    const attempt = vi.fn().mockRejectedValue(dropped());
    await expect(retrying('x', attempt, undefined, quick)).rejects.toThrow('fetch failed');
    expect(attempt).toHaveBeenCalledTimes(4);
  });
});
