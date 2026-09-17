/**
 * Taking the screen off an attached device, shared by the two things that do it.
 *
 * `shot.mjs` is the command line; `shotServer.mjs` is the page with buttons.
 * They differ only in how you ask.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const OUT = path.join('design', 'raw');

export function devices() {
  return execFileSync('adb', ['devices'], { encoding: 'utf8' })
    .split('\n')
    .slice(1)
    .map((line) => line.split('\t'))
    .filter((parts) => parts[1]?.trim() === 'device')
    .map((parts) => parts[0]);
}

/**
 * The bytes of whatever is on screen, as a PNG.
 *
 * `exec-out`, not `shell`: `shell` translates \n on the way back and corrupts
 * every PNG it touches. It fails silently, producing a file that is the right
 * size and will not open.
 */
export function grab(device) {
  return execFileSync('adb', ['-s', device, 'exec-out', 'screencap', '-p'], {
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Width and height read out of the PNG header, to report what was captured. */
export function sizeOf(png) {
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

export function save(png, name) {
  mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${name.replace(/\.png$/i, '')}.png`);
  writeFileSync(file, png);
  return file;
}
