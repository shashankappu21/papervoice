/**
 * Loads the local .env into this process, for the builds.
 *
 * Expo inlines EXPO_PUBLIC_* variables into the JavaScript bundle at build
 * time. Its CLI reads .env for `expo start`, but a release built straight
 * through Gradle is not promised to, so the build scripts load it themselves
 * and Gradle inherits it.
 *
 * .env is git-ignored. Values are never printed.
 */
import { existsSync, readFileSync } from 'node:fs';

export const FEEDBACK_KEY = 'EXPO_PUBLIC_FEEDBACK_ENDPOINT';

/** KEY=value lines; # comments and blank lines skipped; quotes trimmed. */
export function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match || line.trim().startsWith('#')) continue;
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

/**
 * Sets anything not already in the environment. Returns the keys it set.
 *
 * .env.local first, as Expo orders them: it holds what belongs to this machine
 * (GRADLE_USER_HOME), which Expo refuses to read from a plain .env.
 */
export function loadEnv(files = ['.env.local', '.env']) {
  const set = [];
  for (const file of files) {
    if (!existsSync(file)) continue;
    for (const [key, value] of Object.entries(parseEnv(readFileSync(file, 'utf8')))) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
        set.push(key);
      }
    }
  }
  return set;
}

/** Says, without the value, whether the app will be able to send feedback. */
export function reportFeedbackEndpoint() {
  if (process.env[FEEDBACK_KEY]) {
    console.log(`${FEEDBACK_KEY} is set: the questionnaire and feedback will send.`);
  } else {
    console.warn(
      `\n${FEEDBACK_KEY} is not set. This build will not offer the questionnaire, and\n` +
        'feedback will go by email only. Add the Apps Script URL to .env to include them.\n',
    );
  }
}
