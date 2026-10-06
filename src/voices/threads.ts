/**
 * How many CPU threads the neural engine runs inference on.
 *
 * A developer setting, not a user one. It exists to answer a question by
 * measurement: whether fewer threads finish each sentence on less energy, or
 * more threads finish it fast enough to let the CPU sleep sooner. Which way that
 * goes depends on the phone's cores and cannot be decided from the code, so one
 * release build carries every option and the battery decides.
 *
 * Kept free of React Native and the database so it runs under the tests.
 */

/** The values worth comparing: one core, the shipped default, and twice that. */
export const THREAD_CHOICES = [1, 2, 4] as const;

/** What has always shipped, and what anything unrecognised falls back to. */
export const DEFAULT_THREADS = 2;

/**
 * Reads the stored setting as a thread count.
 *
 * Anything that is not one of the offered choices -- missing, mistyped, or a
 * value from some future build -- is the default rather than an error. A bad
 * developer setting must never be the reason a book will not read.
 */
export function parseThreads(stored: string | null | undefined): number {
  const value = Number(stored);
  return (THREAD_CHOICES as readonly number[]).includes(value) ? value : DEFAULT_THREADS;
}
