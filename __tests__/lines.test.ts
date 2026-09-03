import { describe, it, expect } from 'vitest';
import { buildLines } from '../src/extraction/lines';
import type { TextItem } from '../src/extraction/types';

const item = (text: string, o: Partial<TextItem> = {}): TextItem => ({
  text,
  page: 1,
  x: 50,
  y: 700,
  width: 10 * text.length,
  height: 12,
  fontSize: 12,
  ...o,
});

describe('buildLines', () => {
  it('groups items sharing a baseline into one line', () => {
    const lines = buildLines([
      item('The count had ', { x: 50, width: 60 }),
      item('not yet spoken.', { x: 110, width: 70 }),
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('The count had not yet spoken.');
  });

  it('keeps items on different baselines apart', () => {
    const lines = buildLines([item('first', { y: 700 }), item('second', { y: 686 })]);
    expect(lines.map((l) => l.text)).toEqual(['first', 'second']);
  });

  it('keeps items apart when they share a baseline on different pages', () => {
    const lines = buildLines([item('one', { page: 1, y: 700 }), item('two', { page: 2, y: 700 })]);
    expect(lines).toHaveLength(2);
    expect(lines[1].page).toBe(2);
  });

  it('tolerates sub-pixel baseline jitter within one line', () => {
    const lines = buildLines([
      item('same', { y: 700.4, x: 50, width: 40 }),
      item('line', { y: 699.7, x: 95, width: 40 }),
    ]);
    expect(lines).toHaveLength(1);
  });

  it('orders items left to right regardless of input order', () => {
    const lines = buildLines([
      item('second', { x: 200, width: 50 }),
      item('first', { x: 50, width: 50 }),
    ]);
    expect(lines[0].text).toBe('first second');
  });
});

describe('buildLines geometry', () => {
  it('spans the box across every item on the line', () => {
    const lines = buildLines([
      item('left', { x: 50, width: 40, height: 12 }),
      item('right', { x: 200, width: 60, height: 18 }),
    ]);
    expect(lines[0].x).toBe(50);
    expect(lines[0].width).toBe(210);
    expect(lines[0].height).toBe(18);
  });

  it('reports the size most characters are set in, not the first or the average', () => {
    // A drop cap: one huge character, then the rest of the line at body size.
    const lines = buildLines([
      item('T', { x: 50, width: 30, fontSize: 40 }),
      item('he rest of this line is body text', { x: 82, width: 200, fontSize: 10 }),
    ]);
    expect(lines[0].fontSize).toBe(10);
  });
});
