import { describe, expect, it } from 'vitest';
import { VOICES } from '../src/voices/catalog';
import registry from '../docs/voice-licences.json';

/**
 * Guards the catalog against drifting from what was actually verified.
 *
 * The audit itself lives in `scripts/auditLicences.ts` and needs the network.
 * This half needs nothing, so it runs on every commit -- which is the point.
 * A licence check that only happens when someone remembers to run it is a
 * licence check that happens once, in the week before launch, on whatever
 * everyone already believes.
 *
 * What it is defending against is specific and has already happened once: the
 * brief's paid tier was built on `arctic`, whose dataset licence is permissive
 * and whose weights are finetuned from lessac, and therefore research-only. A
 * believable sentence in a planning document survived for months. A row in a
 * table that disagrees with the catalog does not survive one commit.
 */

type Verdict = 'clear' | 'attribution' | 'blocked' | 'unknown';
interface Row {
  id: string;
  name: string;
  offered: boolean;
  verdict: Verdict;
  why: string;
  cardUrl: string;
}
const rows = registry.voices as Row[];
const byId = new Map(rows.map((row) => [row.id, row]));

/** Verdicts that permit selling the app. Everything else, including not knowing. */
const SELLABLE: Verdict[] = ['clear', 'attribution'];

describe('the voice licence registry', () => {
  it('covers every voice in the catalog', () => {
    // A voice added without being audited is the failure this catches: it
    // would otherwise ship with whatever licence string its author typed.
    const missing = VOICES.filter((voice) => !byId.has(voice.id)).map((voice) => voice.id);
    expect(missing, 'run: npm run audit:licences').toEqual([]);
  });

  it('describes no voice the catalog has dropped', () => {
    const stale = rows.filter((row) => !VOICES.some((voice) => voice.id === row.id));
    expect(stale.map((row) => row.id)).toEqual([]);
  });

  it('cites a source for every verdict', () => {
    // A verdict with nowhere to go and check it is an opinion.
    expect(rows.filter((row) => !row.cardUrl.startsWith('https://')).map((r) => r.id)).toEqual([]);
  });

  it('offers nothing the audit will not clear', () => {
    /*
     * The invariant now that the non-commercial voices are gone. It used to
     * read the other way -- those voices were legitimate while the app was
     * free, and the test only asked that the catalog admit which ones they
     * were. There is no longer a category of voice that is offered and cannot
     * be sold, so anything appearing here is a mistake rather than a decision.
     */
    const unsellable = VOICES.filter((voice) => {
      const row = byId.get(voice.id);
      return !voice.hidden && row && !SELLABLE.includes(row.verdict);
    }).map((voice) => `${voice.name}: ${byId.get(voice.id)?.why}`);

    expect(unsellable).toEqual([]);
  });
});

describe('the roster that can be sold', () => {
  it('offers fifteen voices', () => {
    /*
     * Three of these existed before ManyVoice. The other fourteen arrived in
     * one 77MB download of public-domain speakers, which is why the number is
     * asserted rather than counted: it should move when a pack is added or a
     * speaker is retired, and never quietly.
     */
    const sellable = VOICES.filter((voice) => {
      const row = byId.get(voice.id);
      return !voice.hidden && row && SELLABLE.includes(row.verdict);
    }).map((voice) => voice.name);

    expect(sellable).toEqual([
      'Lyra',
      'Kristin',
      'Cori',
      'Kara',
      'Maria',
      'Mike',
      'Mark',
      'Michael',
      'James',
      'Wendell',
      'Steve',
      'Paul',
      'Jenny',
      'Emily',
      'Martin',
    ]);
  });
});
