import { Paths } from 'expo-file-system';

/**
 * Where a downloaded voice lives on the device. During development the files
 * are pushed here with adb rather than downloaded; nothing is ever bundled in
 * the app, and a voice works fully offline once it is present.
 */
export interface VoicePaths {
  model: string;
  tokens: string;
  dataDir: string;
}

/**
 * sherpa-onnx opens these paths itself, so they must be plain filesystem paths.
 * Everything else in the app speaks in `file://` URIs.
 */
function plainPath(uri: string): string {
  return uri.replace(/^file:\/\//, '').replace(/\/$/, '');
}

export function voicePaths(voiceId: string, modelFile: string): VoicePaths {
  const dir = `${plainPath(Paths.document.uri)}/models/${voiceId}`;
  return {
    model: `${dir}/${modelFile}`,
    tokens: `${dir}/tokens.txt`,
    dataDir: `${dir}/espeak-ng-data`,
  };
}

/** The bundled default from the launch roster: public domain, single speaker. */
export const LJSPEECH = { id: 'ljspeech', file: 'en_US-ljspeech-medium.onnx' };
