import { describe, expect, it } from 'vitest';
import {
  coverage,
  describe as show,
  diffTokenMaps,
  parsePhonemeIdMap,
  parseTokens,
} from '../src/voices/tokens';

describe('parseTokens', () => {
  it('reads symbol and id', () => {
    expect(parseTokens('a 1\nb 2\n')).toEqual(
      new Map([
        [1, 'a'],
        [2, 'b'],
      ]),
    );
  });

  it('reads a literal space, which splits into an empty first field', () => {
    // "  32" is the space symbol. Treating the line as malformed drops the
    // token that separates every word from the next.
    expect(parseTokens('  32\n').get(32)).toBe(' ');
  });

  it('survives carriage returns', () => {
    expect(parseTokens('a 1\r\n').get(1)).toBe('a');
  });
});

describe('parsePhonemeIdMap', () => {
  it('inverts Piper config into the same shape as a tokens file', () => {
    expect(parsePhonemeIdMap({ a: [1], b: [2, 3] })).toEqual(
      new Map([
        [1, 'a'],
        [2, 'b'],
        [3, 'b'],
      ]),
    );
  });
});

describe('diffTokenMaps', () => {
  const base = new Map([
    [1, 'a'],
    [2, 'b'],
  ]);

  it('calls two equal maps identical', () => {
    expect(diffTokenMaps(base, new Map(base)).identical).toBe(true);
  });

  it('reports an id that means different things in each', () => {
    /*
     * The case worth catching. A model whose id 2 is some other sound does not
     * fail to load -- it speaks, wrongly, and the result sounds like a poor
     * voice rather than a wiring mistake.
     */
    const other = new Map([
      [1, 'a'],
      [2, 'z'],
    ]);
    const diff = diffTokenMaps(base, other);
    expect(diff.identical).toBe(false);
    expect(diff.conflicting).toEqual([{ id: 2, a: 'b', b: 'z' }]);
  });

  it('reports ids present on only one side', () => {
    const diff = diffTokenMaps(base, new Map([[1, 'a']]));
    expect(diff.onlyInA).toEqual([2]);
    expect(diff.onlyInB).toEqual([]);
  });
});

describe('coverage', () => {
  const tokens = new Map([
    [1, 'd'],
    [2, 'ʒ'],
    [3, 'ʤ'],
  ]);

  it('finds symbols the model has no token for', () => {
    expect(coverage('dʒx', tokens).unmappable).toEqual(['x']);
  });

  it('counts distinct symbols, not occurrences', () => {
    expect(coverage('dddʒ', tokens)).toMatchObject({ covered: 2, total: 2 });
  });

  it('separates a two-character sequence from the single ligature', () => {
    /*
     * The distinction the Kitten diagnosis turned on, and the reason this
     * splits by code point rather than by grapheme.
     *
     * Both encode the same sound and Kitten has tokens for both, so neither is
     * unmappable -- which is exactly the finding: the mapping was never the
     * fault. The model was trained on U+02A4 as one token, and being handed
     * "d" then U+0292 gives it a sequence it did not learn. Two claims that
     * eSpeak "cannot emit" these symbols came from not looking at this.
     */
    expect(coverage('dʒ', tokens).unmappable).toEqual([]);
    expect(coverage('ʤ', tokens).unmappable).toEqual([]);
    expect(coverage('dʒ', tokens).covered).toBe(2);
    expect(coverage('ʤ', tokens).covered).toBe(1);
  });
});

describe('describe', () => {
  it('writes code points, so lookalike symbols are told apart in a report', () => {
    expect(show('ʤ')).toBe('"ʤ" (U+02A4)');
    expect(show('dʒ')).toBe('"dʒ" (U+0064 U+0292)');
  });
});
