/**
 * Reading what Android says about battery, and what the app logged.
 *
 * Kept apart from the script that drives a run so it can be tested against
 * real output. The formats were taken from an actual device (Android 13,
 * ColorOS) rather than from documentation: dumpsys output is not a stable
 * interface, it differs between versions and manufacturers, and a parser
 * written from memory produces numbers that look right and are not. Anything
 * that cannot be found is reported as null, never guessed.
 */

/** "2d 14h 13m 45s 761ms" -> milliseconds. */
export function parseDuration(text) {
  if (!text) return null;
  const units = { d: 86_400_000, h: 3_600_000, m: 60_000, s: 1_000, ms: 1 };
  let total = 0;
  let found = false;
  // "ms" before "m" and "s", or "761ms" would be read as minutes.
  for (const match of String(text).matchAll(/(\d+)\s*(ms|d|h|m|s)\b/g)) {
    total += Number(match[1]) * units[match[2]];
    found = true;
  }
  return found ? total : null;
}

/** The output of `dumpsys battery`. */
export function parseBattery(text) {
  const flag = (name) => new RegExp(`${name} powered:\\s*true`, 'i').test(text);
  const number = (name) => {
    const match = new RegExp(`^\\s*${name}:\\s*(-?\\d+)`, 'm').exec(text);
    return match ? Number(match[1]) : null;
  };
  const tenths = number('temperature');
  const status = number('status');
  return {
    plugged: flag('AC') || flag('USB') || flag('Wireless'),
    // BatteryManager: 2 charging, 3 discharging, 4 not charging, 5 full.
    charging: status === 2,
    level: number('level'),
    temperatureC: tenths === null ? null : tenths / 10,
  };
}

/**
 * The label batterystats uses for an app's uid: 11191 -> "u0a1191".
 *
 * A uid is user * 100000 + app id, and app ids start at 10000.
 */
export function uidLabel(uid) {
  const user = Math.floor(uid / 100_000);
  const app = uid % 100_000;
  return `u${user}a${app - 10_000}`;
}

/**
 * The app's own block in `dumpsys batterystats <package>`.
 *
 *   u0a1191:
 *     Wake lock ExoPlayer:WakeLockManager: 6m 5s 928ms partial (149 times) ...
 *     TOTAL wake: 12m 4s 887ms blamed partial, ...
 *     Audio: 32m 42s 804ms realtime (347 times)
 *     Foreground services: 20m 38s 187ms realtime (6 times)
 *     Total cpu time: u=19m 27s 170ms s=3m 18s 569ms
 */
export function parseUidBlock(text, label) {
  const lines = String(text).split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${label}:` && /^ {2}\S/.test(line));
  if (start === -1) return null;

  const block = [];
  for (const line of lines.slice(start + 1)) {
    // The block ends at the next line indented less than its own contents.
    if (line.trim() !== '' && !/^ {4}/.test(line)) break;
    block.push(line);
  }
  const body = block.join('\n');

  const cpu = /Total cpu time:\s*u=([^\n]*?)\s+s=([^\n]*?)\s*$/m.exec(body);
  const wakelocks = [];
  for (const match of body.matchAll(/^\s*Wake lock (.+?): ([\d hdms]+?) partial \((\d+) times\)/gm)) {
    wakelocks.push({ name: match[1], ms: parseDuration(match[2]), times: Number(match[3]) });
  }
  const after = (name) => {
    const match = new RegExp(`^\\s*${name}:\\s*([\\d hdms]+?)\\s+(?:realtime|blamed|$)`, 'm').exec(body);
    return match ? parseDuration(match[1]) : null;
  };

  return {
    cpuUserMs: cpu ? parseDuration(cpu[1]) : null,
    cpuSystemMs: cpu ? parseDuration(cpu[2]) : null,
    wakelocks,
    totalWakeMs: after('TOTAL wake'),
    audioMs: after('Audio'),
    foregroundServiceMs: after('Foreground services'),
  };
}

/**
 * The app's line under "Estimated power use (mAh)".
 *
 *   UID u0a1191: 113 fg: 32.7 fgs: 19.9 cached: 0.113 ( screen=56.8 (20m 16s 889ms)
 *     cpu=52.7 (22m 45s 740ms) ... wakelock=1.31 (12m 4s 887ms) )
 *
 * A model's estimate built from the device's power profile, not a meter: good
 * for comparing runs on one phone, not for quoting in milliamp-hours.
 */
export function parseEstimatedPower(text, label) {
  const line = String(text)
    .split(/\r?\n/)
    .find((candidate) => candidate.trim().startsWith(`UID ${label}:`));
  if (!line) return null;

  const total = new RegExp(`UID ${label}:\\s*([\\d.]+)`).exec(line);
  const component = (name) => {
    const match = new RegExp(`\\b${name}=([\\d.]+)`).exec(line);
    return match ? Number(match[1]) : null;
  };
  return {
    totalMah: total ? Number(total[1]) : null,
    cpuMah: component('cpu'),
    screenMah: component('screen'),
    wakelockMah: component('wakelock'),
  };
}

/**
 * The app's own log, from logcat.
 *
 *   [papervoice] rtf 0.412 | synth 1834ms | 4.6s audio | 112 chars | 2 threads | Lyra
 *   [papervoice] Lyra loaded on 2 inference thread(s)
 *
 * `audioSec` includes the silence written after each sentence, so it is close
 * to, but a little more than, the speech alone.
 */
export function parseSynthLog(text) {
  let sentences = 0;
  let synthMs = 0;
  let audioSec = 0;
  const threadsSeen = new Set();
  const loadedOn = [];

  for (const match of String(text).matchAll(
    /\[papervoice\] rtf [\d.]+ \| synth (\d+)ms \| ([\d.]+)s audio \| \d+ chars \| (\S+) threads/g,
  )) {
    sentences += 1;
    synthMs += Number(match[1]);
    audioSec += Number(match[2]);
    threadsSeen.add(match[3]);
  }
  for (const match of String(text).matchAll(/\[papervoice\] .+? loaded on (\d+) inference thread/g)) {
    loadedOn.push(Number(match[1]));
  }

  return { sentences, synthMs, audioSec, threadsSeen: [...threadsSeen], loadedOn };
}

/**
 * The comparison the experiment exists for.
 *
 * Synthesis cannot have used more CPU than its threads, each busy for the
 * whole of every synthesis call: threads x wall time is a ceiling, and the
 * real figure is below it. So whatever CPU the app used beyond that ceiling
 * was certainly spent on something other than synthesis.
 */
export function compare({ cpuMs, threads, synthMs }) {
  if (cpuMs === null || cpuMs === undefined || !threads) return null;
  const ceilingMs = threads * synthMs;
  return {
    ceilingMs,
    ratio: ceilingMs > 0 ? cpuMs / ceilingMs : null,
    // At least this much was not synthesis. Zero means synthesis could
    // account for all of it -- not that it must have.
    notSynthesisAtLeastMs: Math.max(0, cpuMs - ceilingMs),
  };
}
