import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildSentences } from '../src/extraction/sentences';
import type { TextItem } from '../src/extraction/types';

/**
 * Real-document regression. The items come from pdf.js running over a real,
 * born-digital book (see `fixtures/README.md`), so this is what catches a
 * refactor that silently degrades extraction quality — the unit tests above
 * only see the cases someone thought to write down.
 */
const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/constitution.items.json', import.meta.url), 'utf8'),
) as { items: TextItem[]; pageHeight: number; pageCount: number };

/** Baseline recorded 2026-09-04, after the line/block pipeline landed. */
const BASELINE = 279;

describe('extraction over a real document', () => {
  const sentences = buildSentences(fixture.items, fixture.pageHeight);

  it('yields a stable number of sentences', () => {
    const drift = Math.abs(sentences.length - BASELINE) / BASELINE;
    expect(drift).toBeLessThanOrEqual(0.02);
  });

  it('keeps the first sentence unchanged', () => {
    expect(sentences[0].text).toBe(
      '110TH CONGRESS DOCUMENT " HOUSE OF REPRESENTATIVES !',
    );
  });

  it('keeps the last sentence unchanged', () => {
    expect(sentences[sentences.length - 1].text).toMatch(
      /^The dates of ratification were: New York, March 27, 1794;/,
    );
  });

  it('reads a body sentence as one uninterrupted unit', () => {
    // The preamble is set in small caps, so pdf.js reports it upper-cased. It is
    // also set smaller than the body, and must still be read as prose rather
    // than written off as a footnote.
    const preamble = sentences.find((s) => s.text.includes('WE THE PEOPLE'));
    expect(preamble?.kind).toBe('body');
    expect(preamble?.text).toContain(
      'WE THE PEOPLE of the United States, in Order to form a more perfect Union, ' +
        'establish Justice, insure domestic Tranquility, provide for the common defence, ' +
        'promote the general Welfare, and secure the Blessings of Liberty to ourselves ' +
        'and our Posterity, do ordain and establish this Constitution for the United ' +
        'States of America.',
    );
  });

  it("strips the printer's running furniture instead of reading it aloud", () => {
    // This edition stamps a watermark and a job-number footer on every page.
    // Both used to land in the middle of body sentences.
    for (const sentence of sentences) {
      expect(sentence.text).not.toContain('cprice-sewell');
      expect(sentence.text).not.toContain('VerDate');
    }
  });

  it('gives every sentence at least one box on a real page', () => {
    for (const sentence of sentences) {
      expect(sentence.boxes.length).toBeGreaterThan(0);
      for (const box of sentence.boxes) {
        expect(box.page).toBeGreaterThanOrEqual(1);
        expect(box.page).toBeLessThanOrEqual(fixture.pageCount);
      }
    }
  });

  it('keeps headings out of the prose around them', () => {
    const headings = sentences.filter((s) => s.kind === 'heading');
    expect(headings.length).toBeGreaterThan(0);
    // A heading is its own utterance, so none of them should carry a sentence
    // of body prose along with it.
    for (const heading of headings) {
      expect(heading.text).not.toMatch(/[a-z]{3,}\.\s+[A-Z]/);
    }
  });

  it('never runs a marginal line number into the text', () => {
    // This edition numbers every line down the margin in small type.
    for (const sentence of sentences) {
      expect(sentence.text).not.toMatch(/^\d{1,2} [A-Z]/);
    }
  });
});
