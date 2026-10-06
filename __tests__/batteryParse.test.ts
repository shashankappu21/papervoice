import { describe, expect, it } from 'vitest';
import * as parse from '../scripts/battery/parse.mjs';

/*
 * Every fixture below is verbatim output from a real device -- Android 13 on
 * ColorOS -- except the synthesis lines, which are the app's own format. The
 * point of these tests is that the parser reads what a phone actually prints.
 */

const BATTERY = `Current Battery Service state:
  AC powered: false
  USB powered: true
  Wireless powered: false
  Max charging current: 500000
  status: 2
  health: 2
  present: true
  level: 47
  scale: 100
  voltage: 4012
  temperature: 331
  technology: Li-poly`;

const BLOCK = `  Estimated power use (mAh):
    UID u0a1191: 113 fg: 32.7 fgs: 19.9 cached: 0.113 ( screen=56.8 (20m 16s 889ms) cpu=52.7 (22m 45s 740ms) cpu:fg=32.7 (3m 54s 650ms) cpu:fgs=19.9 (2m 43s 993ms) cpu:cached=0.113 (614ms) audio=0 (32m 42s 803ms) system_services=2.13 wakelock=1.31 (12m 4s 887ms) )
    UID u0a1029: 112 fg: 50.4 bg: 10.5 cached: 5.78 ( screen=42.3 (15m 6s 788ms) cpu=66.7 (22m 8s 558ms) )

  u0a1191:
    Wake lock *dexopt* realtime
    Wake lock AudioMix: 5m 58s 959ms partial (149 times) max=31597 actual=858246 realtime
    Wake lock ExoPlayer:WakeLockManager: 6m 5s 928ms partial (149 times) max=31780 actual=873528 realtime
    Wake lock *launch* realtime
    TOTAL wake: 12m 4s 887ms blamed partial, 14m 36s 238ms actual partial realtime
    Audio: 32m 42s 804ms realtime (347 times)
    Foreground activities: 20m 16s 889ms realtime (8 times)
    Foreground services: 20m 38s 187ms realtime (6 times)
    Total cpu time: u=19m 27s 170ms s=3m 18s 569ms
    Proc app.papervoice:
      CPU: 17m 5s 520ms usr + 1m 37s 620ms krn ; 10m 54s 30ms fg

Per process state tracking available: true`;

describe('durations as batterystats writes them', () => {
  it('reads every unit, and never mistakes milliseconds for minutes', () => {
    expect(parse.parseDuration('761ms')).toBe(761);
    expect(parse.parseDuration('19m 27s 170ms')).toBe(19 * 60_000 + 27_000 + 170);
    expect(parse.parseDuration('2d 14h 13m 45s 761ms')).toBe(
      2 * 86_400_000 + 14 * 3_600_000 + 13 * 60_000 + 45_000 + 761,
    );
  });

  it('is null when there is no duration, rather than zero', () => {
    expect(parse.parseDuration('')).toBeNull();
    expect(parse.parseDuration('realtime')).toBeNull();
  });
});

describe('the battery state', () => {
  it('sees a phone on a cable as plugged in and charging', () => {
    expect(parse.parseBattery(BATTERY)).toEqual({
      plugged: true,
      charging: true,
      level: 47,
      temperatureC: 33.1,
    });
  });

  it('sees an unplugged phone as unplugged', () => {
    const off = BATTERY.replace('USB powered: true', 'USB powered: false').replace('status: 2', 'status: 3');
    expect(parse.parseBattery(off).plugged).toBe(false);
    expect(parse.parseBattery(off).charging).toBe(false);
  });
});

describe("the app's uid", () => {
  it('is labelled the way batterystats labels it', () => {
    expect(parse.uidLabel(11191)).toBe('u0a1191');
    // A second user on the same phone, as this one has.
    expect(parse.uidLabel(1011191)).toBe('u10a1191');
  });
});

describe("the app's own block", () => {
  it('reads CPU time, wake locks, audio and the foreground service', () => {
    // Found, or the null check below would have failed first.
    const block = parse.parseUidBlock(BLOCK, 'u0a1191')!;

    expect(block.cpuUserMs).toBe(19 * 60_000 + 27_000 + 170);
    expect(block.cpuSystemMs).toBe(3 * 60_000 + 18_000 + 569);
    expect(block.wakelocks).toEqual([
      { name: 'AudioMix', ms: 5 * 60_000 + 58_000 + 959, times: 149 },
      { name: 'ExoPlayer:WakeLockManager', ms: 6 * 60_000 + 5_000 + 928, times: 149 },
    ]);
    expect(block.totalWakeMs).toBe(12 * 60_000 + 4_000 + 887);
    expect(block.audioMs).toBe(32 * 60_000 + 42_000 + 804);
    expect(block.foregroundServiceMs).toBe(20 * 60_000 + 38_000 + 187);
  });

  it('does not run on into what follows the block', () => {
    // "Proc app.papervoice" is inside; "Per process state" is not.
    const block = parse.parseUidBlock(BLOCK, 'u0a1191');
    expect(block).not.toBeNull();
  });

  it('is null for an app that is not there', () => {
    expect(parse.parseUidBlock(BLOCK, 'u0a9999')).toBeNull();
  });
});

describe('the estimated power line', () => {
  it("reads this app's line, not the next app's", () => {
    expect(parse.parseEstimatedPower(BLOCK, 'u0a1191')).toEqual({
      totalMah: 113,
      cpuMah: 52.7,
      screenMah: 56.8,
      wakelockMah: 1.31,
    });
  });
});

describe("the app's synthesis log", () => {
  const LOG = [
    '10-06 14:30:01.000 I/ReactNativeJS( 7298): [papervoice] Lyra loaded on 2 inference thread(s)',
    '10-06 14:30:03.000 I/ReactNativeJS( 7298): [papervoice] rtf 0.412 | synth 1834ms | 4.6s audio | 112 chars | 2 threads | Lyra',
    '10-06 14:30:05.000 I/ReactNativeJS( 7298): [papervoice] rtf 0.380 | synth 1200ms | 3.4s audio | 80 chars | 2 threads | Lyra',
    '10-06 14:30:06.000 I/ReactNativeJS( 7298): [papervoice] something else entirely',
  ].join('\n');

  it('adds up every synthesised sentence', () => {
    expect(parse.parseSynthLog(LOG)).toEqual({
      sentences: 2,
      synthMs: 3034,
      audioSec: 8,
      threadsSeen: ['2'],
      loadedOn: [2],
    });
  });

  it('notices when a run mixed thread counts', () => {
    const mixed = LOG + '\n[papervoice] rtf 0.300 | synth 900ms | 3.0s audio | 70 chars | 4 threads | Lyra';
    expect(parse.parseSynthLog(mixed).threadsSeen.sort()).toEqual(['2', '4']);
  });
});

describe('the comparison', () => {
  it('puts a ceiling on what synthesis could have used', () => {
    // 2 threads busy for 100s of synthesis can have used at most 200s of CPU.
    const result = parse.compare({ cpuMs: 300_000, threads: 2, synthMs: 100_000 })!;
    expect(result.ceilingMs).toBe(200_000);
    expect(result.ratio).toBe(1.5);
    expect(result.notSynthesisAtLeastMs).toBe(100_000);
  });

  it('says nothing is certainly elsewhere when CPU fits under the ceiling', () => {
    expect(parse.compare({ cpuMs: 150_000, threads: 2, synthMs: 100_000 })!.notSynthesisAtLeastMs).toBe(0);
  });

  it('refuses to compare without the numbers', () => {
    expect(parse.compare({ cpuMs: null, threads: 2, synthMs: 100 })).toBeNull();
    expect(parse.compare({ cpuMs: 100, threads: 0, synthMs: 100 })).toBeNull();
  });
});
