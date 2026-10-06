/**
 * Measures what listening costs, on the phone, with nothing guessed.
 *
 *   npm run battery -- run 2t                one 30-minute run, labelled "2t"
 *   npm run battery -- run 4t --minutes 20   a shorter one
 *   npm run battery -- report                every run so far, side by side
 *
 * A run resets Android's battery statistics, streams the app's log to a file
 * for the whole run, and at the end collects the app's CPU time, wake locks
 * and estimated power, adds up every sentence synthesised, and puts the two
 * side by side. Ctrl-C ends a run early and still collects.
 *
 * Built around the ways this measurement goes wrong without anyone noticing:
 *
 *   - A phone on a cable is charging, and charging is not counted. It refuses
 *     to start on one, and tells you how to switch adb to Wi-Fi.
 *   - logcat's ring buffer drops the start of a long run, which would make the
 *     synthesis total short. The log is streamed to a file instead.
 *   - Audio already in the cache is replayed, not synthesised, and makes a run
 *     look far cheaper than it is. It warns when much less new audio was made
 *     than the run lasted.
 *   - A run that mixed thread counts compares nothing. It says so.
 *
 * Everything raw is kept beside the summary in design/battery/, so a number
 * that looks wrong can be checked against what the phone actually said.
 */
import { execFileSync, spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import * as parse from './battery/parse.mjs';

const PACKAGE = 'app.papervoice';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNS = path.join(ROOT, 'design', 'battery');

/** Below this, run-to-run noise is larger than the difference being measured. */
const NOISE = 0.1;

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? undefined : args[at + 1];
};
const has = (name) => args.includes(`--${name}`);

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const seconds = (ms) => (ms === null || ms === undefined ? '—' : `${(ms / 1000).toFixed(1)} s`);
const clock = (ms) => {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

// ---------------------------------------------------------------- adb

function devices() {
  return execFileSync('adb', ['devices'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split('\t'))
    .filter((parts) => parts[1]?.trim() === 'device')
    .map((parts) => parts[0]);
}

/**
 * The phone to measure. A Wi-Fi connection is preferred when there are two,
 * because the USB one is charging the phone and so cannot be measured on.
 */
function pickDevice() {
  const asked = flag('device');
  const attached = devices();
  if (asked) {
    if (!attached.includes(asked)) fail(`${asked} is not attached. adb sees: ${attached.join(', ') || 'nothing'}`);
    return asked;
  }
  if (attached.length === 0) fail('No phone attached. Connect it over USB first, to set up adb over Wi-Fi.');
  if (attached.length === 1) return attached[0];
  const wireless = attached.filter((serial) => serial.includes(':'));
  if (wireless.length === 1) return wireless[0];
  fail(`More than one phone attached (${attached.join(', ')}). Say which with --device.`);
}

const adb = (device, ...rest) =>
  execFileSync('adb', ['-s', device, ...rest], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function uidOf(device) {
  const match = /userId=(\d+)/.exec(adb(device, 'shell', 'dumpsys', 'package', PACKAGE));
  if (!match) fail(`${PACKAGE} is not installed on ${device}.`);
  return Number(match[1]);
}

function phoneAddress(device) {
  try {
    return /inet (\d+\.\d+\.\d+\.\d+)/.exec(adb(device, 'shell', 'ip', '-f', 'inet', 'addr', 'show', 'wlan0'))?.[1] ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- run

async function run() {
  const label = args[1];
  if (!label || label.startsWith('--')) fail('Give the run a name: npm run battery -- run 2t');
  if (!/^[\w.-]+$/.test(label)) fail('Keep the name to letters, numbers, dots and dashes: it becomes a folder.');

  const minutes = Number(flag('minutes') ?? 30);
  if (!(minutes > 0)) fail('--minutes must be a positive number.');

  const device = pickDevice();
  const uid = uidOf(device);
  const appLabel = parse.uidLabel(uid);
  const before = parse.parseBattery(adb(device, 'shell', 'dumpsys', 'battery'));

  if (before.plugged) {
    const ip = phoneAddress(device);
    fail(
      [
        'The phone is plugged in, so it is charging, and charging is not counted.',
        'Switch adb to Wi-Fi, then unplug the cable and run this again:',
        '',
        '  adb tcpip 5555',
        `  adb connect ${ip ?? '<phone-ip>'}:5555`,
        ip ? '' : '\n  (the phone\'s address is in Settings → Wi-Fi → your network)',
      ].join('\n'),
    );
  }

  const warnings = [];
  if (before.level !== null && before.level < 30) {
    warnings.push(`Started at ${before.level}% battery. Battery saver and low-battery throttling change how the CPU behaves; 60% or more is safer.`);
  }
  if (before.temperatureC !== null && before.temperatureC >= 38) {
    warnings.push(`Started at ${before.temperatureC} °C. A warm phone throttles; let it cool for comparable runs.`);
  }

  console.log(`\nBattery run "${label}" -- ${minutes} min on ${device} (${appLabel})`);
  console.log(`Battery ${before.level}%, ${before.temperatureC} °C\n`);
  console.log('Before pressing Enter, on the phone:');
  console.log('  1. Settings -> tap the title 7x -> the thread count for this run');
  console.log('  2. Force-stop Papervoice and open it again, so that count is loaded');
  console.log('  3. Settings -> Apps -> Papervoice -> Storage -> Clear cache');
  console.log('  4. Same voice, speed and volume as the other runs\n');

  if (!has('yes')) {
    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
    await prompt.question('Press Enter to start. ');
    prompt.close();
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})/, '$1-');
  const dir = path.join(RUNS, `${stamp}-${label}`);
  mkdirSync(dir, { recursive: true });

  adb(device, 'shell', 'dumpsys', 'batterystats', '--reset');
  adb(device, 'logcat', '-c');

  // Streamed, not read back at the end: the ring buffer would have dropped
  // the start of a half-hour run, and the synthesis total with it.
  const logFile = path.join(dir, 'logcat.txt');
  const logOut = createWriteStream(logFile);
  const log = spawn('adb', ['-s', device, 'logcat', '-v', 'time', 'ReactNativeJS:I', '*:S']);
  log.stdout.pipe(logOut);
  let logEndedAt = null;

  const startedAt = Date.now();
  const limit = minutes * 60_000;
  log.on('exit', () => {
    logEndedAt = Date.now();
  });

  console.log('\nRunning. Now press play on the phone, then turn the screen off.');
  console.log('Ctrl-C ends early and still collects. Ctrl-C twice abandons the run.\n');

  await new Promise((resolve) => {
    const tick = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const dropped = logEndedAt ? '   LOG STREAM DROPPED' : '';
      process.stdout.write(`\r  ${clock(elapsed)} / ${clock(limit)}${dropped}   `);
      if (elapsed >= limit) finish();
    }, 1000);

    let interrupted = false;
    const onInterrupt = () => {
      if (interrupted) {
        console.log('\nAbandoned. Nothing collected.');
        process.exit(130);
      }
      interrupted = true;
      finish();
    };
    process.on('SIGINT', onInterrupt);

    function finish() {
      clearInterval(tick);
      process.off('SIGINT', onInterrupt);
      process.stdout.write('\n');
      resolve();
    }
  });

  const elapsedMs = Date.now() - startedAt;
  console.log('\nCollecting...');

  const after = parse.parseBattery(adb(device, 'shell', 'dumpsys', 'battery'));
  const stats = adb(device, 'shell', 'dumpsys', 'batterystats', PACKAGE);
  writeFileSync(path.join(dir, 'batterystats.txt'), stats);

  if (logEndedAt === null) log.kill();
  await new Promise((resolve) => logOut.end(resolve));

  const block = parse.parseUidBlock(stats, appLabel);
  const estimated = parse.parseEstimatedPower(stats, appLabel);
  const synth = parse.parseSynthLog(readFileSync(logFile, 'utf8'));

  const cpuMs = block && block.cpuUserMs !== null ? block.cpuUserMs + (block.cpuSystemMs ?? 0) : null;
  const threads =
    synth.threadsSeen.length === 1 && /^\d+$/.test(synth.threadsSeen[0])
      ? Number(synth.threadsSeen[0])
      : synth.loadedOn.length === 1
        ? synth.loadedOn[0]
        : null;
  const comparison = parse.compare({ cpuMs, threads, synthMs: synth.synthMs });

  // ------------------------------------------------ what could make it wrong
  if (after.plugged) warnings.push('The phone was plugged in by the end. Battery figures for this run are not valid.');
  if (logEndedAt !== null && logEndedAt - startedAt < elapsedMs - 5_000) {
    warnings.push(`The log stream stopped at ${clock(logEndedAt - startedAt)} -- Wi-Fi dropped? The synthesis total is short; batterystats are still whole.`);
  }
  if (!block) warnings.push(`Could not find ${appLabel} in batterystats. The raw output is saved beside this.`);
  if (synth.sentences === 0) {
    warnings.push('Nothing was synthesised. Was play pressed after Enter, and the cache cleared?');
  } else if (synth.audioSec < 0.7 * (elapsedMs / 1000)) {
    warnings.push(
      `Only ${(synth.audioSec / 60).toFixed(1)} min of new audio was made in a ${(elapsedMs / 60_000).toFixed(1)} min run. ` +
        'Most of it played from cache, or playback was paused. Clear the cache before each run.',
    );
  }
  if (synth.threadsSeen.length > 1) {
    warnings.push(`This run mixed thread counts (${synth.threadsSeen.join(', ')}), so it compares nothing. Force-stop after changing the setting.`);
  }
  if (synth.sentences > 0 && threads === null) warnings.push('Could not tell which thread count ran.');

  const summary = {
    label,
    startedAt: new Date(startedAt).toISOString(),
    minutes: elapsedMs / 60_000,
    device,
    uid,
    threads,
    battery: {
      start: before,
      end: after,
      dropPoints: before.level !== null && after.level !== null ? before.level - after.level : null,
    },
    cpu: block ? { userMs: block.cpuUserMs, systemMs: block.cpuSystemMs, totalMs: cpuMs } : null,
    wakelocks: block?.wakelocks ?? [],
    totalWakeMs: block?.totalWakeMs ?? null,
    audioMs: block?.audioMs ?? null,
    foregroundServiceMs: block?.foregroundServiceMs ?? null,
    estimated,
    synth,
    comparison,
    warnings,
  };
  writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2));

  printSummary(summary);
  console.log(`\nSaved in ${path.relative(ROOT, dir)}`);
}

function printSummary(s) {
  const c = s.comparison;
  console.log(`\nRun "${s.label}" -- ${s.minutes.toFixed(1)} min, ${s.threads ?? '?'} thread(s)\n`);
  console.log(`  CPU time           ${seconds(s.cpu?.totalMs)}  (user ${seconds(s.cpu?.userMs)} + system ${seconds(s.cpu?.systemMs)})`);
  console.log(`  Synthesis ceiling  ${seconds(c?.ceilingMs)}  (${s.threads ?? '?'} threads x ${seconds(s.synth.synthMs)} synthesising, ${s.synth.sentences} sentences)`);
  console.log(`  CPU / ceiling      ${c?.ratio === null || c?.ratio === undefined ? '—' : c.ratio.toFixed(2)}`);
  console.log(`  Not synthesis      at least ${seconds(c?.notSynthesisAtLeastMs)}`);
  if (s.estimated) {
    console.log(`  Estimated power    ${s.estimated.totalMah} mAh (cpu ${s.estimated.cpuMah}, wakelock ${s.estimated.wakelockMah}) -- for comparing runs, not quoting`);
  }
  const b = s.battery;
  console.log(`  Battery            ${b.start.level}% -> ${b.end.level}% (${b.dropPoints ?? '?'} points), ${b.start.temperatureC} -> ${b.end.temperatureC} °C`);
  console.log(`  New audio made     ${(s.synth.audioSec / 60).toFixed(1)} min`);
  if (s.wakelocks.length) {
    console.log(`  Wake locks         ${s.wakelocks.map((w) => `${w.name} ${seconds(w.ms)} x${w.times}`).join(' | ')}`);
  }

  // The rule the experiment was set up to apply. The thresholds are a reading
  // aid, not a law: the ratio and the raw numbers are what to decide on.
  if (c?.ratio !== null && c?.ratio !== undefined) {
    console.log('');
    if (c.ratio <= 1) {
      console.log('  Synthesis can account for all of the app\'s CPU. Comparing thread counts is worth doing.');
    } else if (c.ratio > 1.5) {
      console.log(`  At least ${seconds(c.notSynthesisAtLeastMs)} of CPU was not synthesis. Look there before tuning threads.`);
    } else {
      console.log('  Mostly synthesis, with some CPU certainly spent elsewhere.');
    }
  }

  for (const warning of s.warnings) console.log(`\n  ! ${warning}`);
}

// ---------------------------------------------------------------- report

function report() {
  if (!existsSync(RUNS)) fail('No runs yet. Start one: npm run battery -- run 2t');
  const runs = readdirSync(RUNS)
    .map((name) => path.join(RUNS, name, 'summary.json'))
    .filter((file) => existsSync(file))
    .map((file) => JSON.parse(readFileSync(file, 'utf8')))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  if (runs.length === 0) fail('No finished runs yet.');

  const rows = runs.map((s) => {
    const minutes = s.minutes || 1;
    return {
      run: s.label,
      thr: s.threads ?? '?',
      min: s.minutes.toFixed(1),
      // Per minute, so a run ended early still compares with a full one.
      'cpu s/min': s.cpu?.totalMs ? (s.cpu.totalMs / 1000 / minutes).toFixed(1) : '—',
      'cpu/ceil': s.comparison?.ratio ? s.comparison.ratio.toFixed(2) : '—',
      'mAh/h': s.estimated?.totalMah ? ((s.estimated.totalMah / minutes) * 60).toFixed(0) : '—',
      'pts/h': s.battery?.dropPoints !== null && s.battery?.dropPoints !== undefined ? ((s.battery.dropPoints / minutes) * 60).toFixed(1) : '—',
      'rtf': s.synth.audioSec ? (s.synth.synthMs / 1000 / s.synth.audioSec).toFixed(3) : '—',
      warn: s.warnings.length || '',
    };
  });

  const columns = Object.keys(rows[0]);
  const widths = columns.map((col) => Math.max(col.length, ...rows.map((row) => String(row[col]).length)));
  const line = (cells) => cells.map((cell, i) => String(cell).padEnd(widths[i])).join('  ');
  console.log(`\n${line(columns)}\n${line(widths.map((w) => '-'.repeat(w)))}`);
  for (const row of rows) console.log(line(columns.map((col) => row[col])));

  console.log(`\n  rtf is duration-weighted: total synthesis time over total audio made.`);
  console.log(`  Differences under ${NOISE * 100}% are within run-to-run noise. Run each setting twice before deciding.`);
  if (runs.some((s) => s.warnings.length)) {
    console.log('  Runs with warnings: see summary.json in that run\'s folder under design/battery/.');
  }
}

// ---------------------------------------------------------------- entry

const command = args[0];
if (command === 'run') await run();
else if (command === 'report') report();
else {
  console.log(`
  npm run battery -- run <name> [--minutes 30] [--device <serial>]
  npm run battery -- report

  A run measures one listening session; report compares them all.
  Results are kept in design/battery/.`);
}
