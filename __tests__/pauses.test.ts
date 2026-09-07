import { describe, it, expect } from 'vitest';
import { pauseAfter } from '../src/tts/pauses';

describe('pauseAfter', () => {
  it('leaves a beat between sentences', () => {
    expect(pauseAfter({ kind: 'body', endsSentence: true })).toBeGreaterThan(150);
  });

  it('leaves longer after a heading, so a chapter title lands', () => {
    expect(pauseAfter({ kind: 'heading', endsSentence: true })).toBeGreaterThan(
      pauseAfter({ kind: 'body', endsSentence: true }),
    );
  });

  it('barely pauses between the pieces of one sentence', () => {
    // A long sentence is cut at a clause boundary for the synthesiser's sake.
    // The listener should not hear the seam.
    const seam = pauseAfter({ kind: 'body', endsSentence: false });
    expect(seam).toBeLessThan(pauseAfter({ kind: 'body', endsSentence: true }));
    expect(seam).toBeGreaterThanOrEqual(0);
  });

  it('never returns a pause long enough to sound like a fault', () => {
    for (const kind of ['heading', 'body', 'note', 'header', 'footer'] as const) {
      for (const endsSentence of [true, false]) {
        expect(pauseAfter({ kind, endsSentence })).toBeLessThanOrEqual(1000);
      }
    }
  });
});

describe('pauseAfter under strain', () => {
  const sentence = { kind: 'body' as const, endsSentence: true };

  it('keeps the full pause while synthesis is comfortably ahead', () => {
    expect(pauseAfter({ ...sentence, rtf: 0.15 })).toBe(pauseAfter(sentence));
  });

  it('shortens but never removes the pause when synthesis is struggling', () => {
    // A sentence that ends with no silence at all sounds cut off, which is
    // worse than the gap the pause was being surrendered to avoid.
    const strained = pauseAfter({ ...sentence, rtf: 0.95 });
    expect(strained).toBeGreaterThan(0);
    expect(strained).toBeLessThan(pauseAfter(sentence));
  });

  it('shortens the pause as synthesis comes under strain', () => {
    const strained = pauseAfter({ ...sentence, rtf: 0.75 });
    expect(strained).toBeGreaterThan(0);
    expect(strained).toBeLessThan(pauseAfter(sentence));
  });

  it('shortens a heading pause under the same strain', () => {
    const heading = { kind: 'heading' as const, endsSentence: true };
    expect(pauseAfter({ ...heading, rtf: 0.95 })).toBeLessThan(pauseAfter(heading));
    expect(pauseAfter({ ...heading, rtf: 0.15 })).toBe(pauseAfter(heading));
  });

  it('always leaves enough silence for a sentence to land', () => {
    for (const rtf of [0.1, 0.5, 0.7, 0.9, 1.5, 3]) {
      expect(pauseAfter({ kind: 'body', endsSentence: true, rtf })).toBeGreaterThanOrEqual(120);
    }
  });

  it('treats a missing measurement as comfortable', () => {
    // The first utterance of a run has nothing measured yet.
    expect(pauseAfter(sentence)).toBeGreaterThan(0);
  });
});
