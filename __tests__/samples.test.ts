import { describe, expect, it, vi } from 'vitest';
import { OFFERED_VOICES, VOICES } from '../src/voices/catalog';

// Vitest cannot resolve a .opus require, and does not need to: what matters
// here is that the two lists agree, not what the assets contain.
vi.mock('../src/voices/samples', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync('src/voices/samples.ts', 'utf8');
  const ids = [...source.matchAll(/^\s*'([^']+)':\s*require\(/gm)].map((m) => m[1]);
  return { SAMPLED_VOICE_IDS: ids, sampleFor: (id: string) => (ids.includes(id) ? 1 : null) };
});

const { SAMPLED_VOICE_IDS } = await import('../src/voices/samples');

describe('voice samples', () => {
  it('has one for every voice on offer', () => {
    // A voice added to the catalog and forgotten here would appear with no
    // way to hear it, which is the one thing the samples exist to prevent.
    const missing = OFFERED_VOICES.filter((v) => !SAMPLED_VOICE_IDS.includes(v.id)).map(
      (v) => v.id,
    );
    expect(missing).toEqual([]);
  });

  it('has none left over for voices that no longer exist', () => {
    // Checked against the whole catalog, not what is offered: a hidden voice
    // keeps its sample, because hiding is reversible and regenerating one
    // means downloading the model again.
    const known = VOICES.map((v) => v.id);
    const orphans = SAMPLED_VOICE_IDS.filter((id) => !known.includes(id));
    expect(orphans).toEqual([]);
  });
});
