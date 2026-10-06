/**
 * Facts read out of an APK itself, with the SDK's aapt2.
 *
 * From the file rather than from app.json or build.gradle, because the file is
 * what people install: a value in the config that did not make it into the
 * build is not a value anyone gets.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

function findAapt2() {
  const home = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || 'G:/Android/Sdk';
  const tools = path.join(home, 'build-tools');
  if (!existsSync(tools)) return null;
  return (
    readdirSync(tools)
      .sort()
      .reverse()
      .map((version) => path.join(tools, version, process.platform === 'win32' ? 'aapt2.exe' : 'aapt2'))
      .find((candidate) => existsSync(candidate)) ?? null
  );
}

/**
 * The APK's minimum API level and versionCode, or null when aapt2 is not to
 * hand -- the caller then leaves them unknown rather than guessing.
 */
export function apkFacts(apkBytes) {
  const aapt2 = findAapt2();
  if (!aapt2) return null;

  const dir = mkdtempSync(path.join(tmpdir(), 'pv-apk-'));
  try {
    const file = path.join(dir, 'app.apk');
    writeFileSync(file, apkBytes);
    const badging = execFileSync(aapt2, ['dump', 'badging', file], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    const minSdk = Number(/minSdkVersion:'(\d+)'/.exec(badging)?.[1]);
    const versionCode = Number(/versionCode='(\d+)'/.exec(badging)?.[1]);
    const versionName = /versionName='([^']+)'/.exec(badging)?.[1] ?? null;
    return { minSdk: minSdk || null, versionCode: versionCode || null, versionName };
  } catch {
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
