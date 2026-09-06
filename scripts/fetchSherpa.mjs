// Downloads the prebuilt sherpa-onnx AAR into the local module's libs/.
//
// The AAR is 49MB, so it is fetched rather than committed: a binary that size
// in git history is permanent, and the release it comes from is immutable.
//
//   npm run setup:tts
import fs from 'node:fs';
import path from 'node:path';

const VERSION = '1.13.7';
const URL = `https://github.com/k2-fsa/sherpa-onnx/releases/download/v${VERSION}/sherpa-onnx-${VERSION}.aar`;
const target = path.join('modules', 'sherpa-tts', 'android', 'libs', `sherpa-onnx-${VERSION}.aar`);

if (fs.existsSync(target)) {
  console.log(`${target} is already present (${(fs.statSync(target).size / 1e6).toFixed(1)}MB)`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
console.log(`downloading ${URL}`);

const response = await fetch(URL);
if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${URL}`);
fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()));

console.log(`wrote ${target} (${(fs.statSync(target).size / 1e6).toFixed(1)}MB)`);
