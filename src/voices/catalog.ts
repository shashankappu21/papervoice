/**
 * The voices this app can install.
 *
 * The catalog ships inside the app so the voice list renders with no network,
 * and every file is named by absolute URL. No voice is bundled: the app is
 * useful the moment it installs, and a natural voice is a deliberate download.
 *
 * Each voice is two plain HTTPS fetches. The phonemiser data every Piper voice
 * shares is installed once, separately, rather than repeated per voice -- which
 * is also what keeps a download free of archives, since React Native has no
 * business unpacking tar.bz2.
 */
export interface VoiceMeta {
  id: string;
  /** A human name. A listener chooses a voice, not a dataset. */
  name: string;
  accent: 'US' | 'GB';
  gender: 'female' | 'male';
  /** Bytes, so the app can say "63 MB" before asking for the download. */
  sizeBytes: number;
  modelUrl: string;
  tokensUrl: string;
  modelSha256: string;
  /** Some voices read slowly by nature and are corrected per voice. */
  defaultRate: number;
  /** What the licence permits, shown rather than buried. */
  licence: string;
}

const SHERPA = 'https://huggingface.co/csukuangfj';

export const VOICES: VoiceMeta[] = [
  {
    id: 'ljspeech-medium',
    name: 'Lyra',
    accent: 'US',
    gender: 'female',
    sizeBytes: 63_531_507,
    modelUrl: `${SHERPA}/vits-piper-en_US-ljspeech-medium/resolve/main/en_US-ljspeech-medium.onnx`,
    tokensUrl: `${SHERPA}/vits-piper-en_US-ljspeech-medium/resolve/main/tokens.txt`,
    modelSha256: '8ceba58a4b540d4e7e7e24ad079cf0d92762a4fd334e059f12940787c6c37b3d',
    defaultRate: 1,
    licence: 'LJ Speech, public domain',
  },
];

export const findVoice = (id: string): VoiceMeta | undefined =>
  VOICES.find((voice) => voice.id === id);
