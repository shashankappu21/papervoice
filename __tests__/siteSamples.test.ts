import { describe, expect, it } from 'vitest';
// @ts-ignore -- plain .mjs
import { renderHero, renderVoices, replaceBlock } from '../scripts/site/samples.mjs';

const lyra = { id: 'ljspeech-medium', name: 'Lyra', accent: 'US', gender: 'female', seconds: 4.02 };
const cori = { id: 'en_GB-cori-medium', name: 'Cori', accent: 'GB', gender: 'female', seconds: 3.5 };
const kara = { id: 'manyvoice-1', name: 'Kara', accent: 'US', gender: 'female', seconds: 3.5 };

describe('the Hear Lyra button', () => {
  it('is a real button that starts unpressed and shows its length', () => {
    const html = renderHero(lyra);
    expect(html).toContain('<button class="hear" type="button" data-sample="ljspeech-medium"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('Hear Lyra');
    expect(html).toContain('<span class="sample-state">4 s</span>');
  });

  it('is absent, not broken, when there is no recording', () => {
    expect(renderHero(null)).toBe('');
  });
});

describe('the voice samples list', () => {
  it('shows the featured voices and folds the rest away', () => {
    const html = renderVoices([lyra, cori, kara], { sentence: 'She paused.' });
    const [shown, folded] = html.split('<details');
    expect(shown).toContain('data-sample="ljspeech-medium"');
    expect(shown).toContain('data-sample="en_GB-cori-medium"');
    expect(folded).toContain('data-sample="manyvoice-1"');
    expect(folded).toContain('All 3 voices');
  });

  it('only has buttons for voices that have a recording', () => {
    const html = renderVoices([lyra]);
    expect(html.match(/data-sample=/g)?.length).toBe(1);
    expect(html).not.toContain('<details');
  });

  it('says UK, as the app does, and quotes the shared line only when there is one', () => {
    expect(renderVoices([cori], { sentence: 'She paused.' })).toContain('UK · female');
    expect(renderVoices([cori], { sentence: 'She paused.' })).toContain('Each reads the same line: “She paused.”');
    expect(renderVoices([cori], { sentence: null })).not.toContain('Each reads the same line');
  });

  it('renders nothing at all with no recordings', () => {
    expect(renderVoices([])).toBe('');
  });

  it('escapes names, in case one ever holds markup', () => {
    expect(renderHero({ ...lyra, name: '<b>Lyra</b>' })).toContain('Hear &lt;b&gt;Lyra&lt;/b&gt;');
  });
});

describe('the marked blocks in the page', () => {
  const page = 'a\n<!-- samples:hero (generated) -->\nOLD\n<!-- /samples:hero -->\nb';

  it('replaces only what is between the markers, keeping them', () => {
    const out = replaceBlock(page, 'hero', 'NEW');
    expect(out).toBe('a\n<!-- samples:hero (generated) -->\nNEW\n<!-- /samples:hero -->\nb');
    // Running it again gives the same page.
    expect(replaceBlock(out, 'hero', 'NEW')).toBe(out);
  });

  it('empties the block when there is nothing to show', () => {
    expect(replaceBlock(page, 'hero', '')).toBe('a\n<!-- samples:hero (generated) -->\n<!-- /samples:hero -->\nb');
  });

  it('refuses a page without the block, rather than silently doing nothing', () => {
    expect(() => replaceBlock('no markers', 'hero', 'x')).toThrow(/no samples:hero block/);
  });
});
