import { describe, it, expect } from 'vitest';
import { buildBlocks } from '../src/extraction/blocks';
import type { Line } from '../src/extraction/types';

/** Body text is 10pt on a 792pt page, one line every 14pt. */
const line = (text: string, o: Partial<Line> = {}): Line => {
  const base = {
    page: 1,
    y: 700,
    x: 50,
    width: 300,
    height: 12,
    fontSize: 10,
    text,
    ...o,
  };
  // A real line always carries the items it was built from, and furniture
  // detection reads them, so the fixture has to supply one.
  return {
    ...base,
    items: o.items ?? [
      {
        text: base.text,
        page: base.page,
        x: base.x,
        y: base.y,
        width: base.width,
        height: base.height,
        fontSize: base.fontSize,
      },
    ],
  };
};

/** Enough body lines that 10pt is unambiguously the document's body size. */
const filler = (count: number, from = 600): Line[] =>
  Array.from({ length: count }, (_, i) => line(`Filler line number ${i}.`, { y: from - i * 14 }));

describe('buildBlocks', () => {
  it('classifies a line larger than the body size as a heading', () => {
    const blocks = buildBlocks([line('THE NEW RULES', { y: 700, fontSize: 20 }), ...filler(20)], 792);
    expect(blocks[0].kind).toBe('heading');
    expect(blocks[0].text).toBe('THE NEW RULES');
  });

  it('classifies a line smaller than the body size as a note', () => {
    const blocks = buildBlocks([...filler(20), line('1. See the appendix.', { y: 200, fontSize: 7 })], 792);
    expect(blocks[blocks.length - 1].kind).toBe('note');
  });

  it('groups consecutive body lines into a single block', () => {
    const blocks = buildBlocks(
      [line('The count had not', { y: 700 }), line('yet spoken at all.', { y: 686 }), ...filler(20)],
      792,
    );
    expect(blocks[0].kind).toBe('body');
    expect(blocks[0].text).toBe('The count had not yet spoken at all.');
  });

  it('starts a new block at a paragraph-sized vertical gap', () => {
    const blocks = buildBlocks(
      [line('End of one paragraph.', { y: 700 }), line('Start of the next.', { y: 660 }), ...filler(20)],
      792,
    );
    expect(blocks[0].text).toBe('End of one paragraph.');
    expect(blocks[1].text).toBe('Start of the next.');
  });

  it('never merges a heading into the body that follows it', () => {
    const blocks = buildBlocks(
      [line('CHAPTER ONE', { y: 700, fontSize: 20 }), line('I was intimidated.', { y: 680 }), ...filler(20)],
      792,
    );
    expect(blocks[0].text).toBe('CHAPTER ONE');
    expect(blocks[1].text).toBe('I was intimidated.');
  });
});

describe('buildBlocks across pages and furniture', () => {
  it('carries an unfinished body block onto the next page', () => {
    const blocks = buildBlocks(
      [
        ...filler(20),
        line('He turned toward the', { page: 1, y: 60 }),
        line('window and waited.', { page: 2, y: 700 }),
      ],
      792,
    );
    const last = blocks[blocks.length - 1];
    expect(last.text).toBe('He turned toward the window and waited.');
  });

  it('starts a new block on the next page when the previous one finished', () => {
    const blocks = buildBlocks(
      [
        ...filler(20),
        line('The chapter ended here.', { page: 1, y: 60 }),
        line('A new thought begins.', { page: 2, y: 700 }),
      ],
      792,
    );
    expect(blocks[blocks.length - 2].text).toBe('The chapter ended here.');
    expect(blocks[blocks.length - 1].text).toBe('A new thought begins.');
  });

  it('joins a word hyphenated across a line break', () => {
    const blocks = buildBlocks(
      [line('the extraordi-', { y: 700 }), line('nary events.', { y: 686 }), ...filler(20)],
      792,
    );
    expect(blocks[0].text).toBe('the extraordinary events.');
  });

  it('marks a running header that repeats across pages as furniture', () => {
    const lines: Line[] = [];
    for (let page = 1; page <= 6; page++) {
      lines.push(line('A Tale of Two Cities', { page, y: 20 }));
      lines.push(...filler(6, 600).map((l) => ({ ...l, page })));
    }
    const blocks = buildBlocks(lines, 792);
    const header = blocks.find((b) => b.text === 'A Tale of Two Cities');
    expect(header?.kind).toBe('furniture');
  });

  it('marks a running header as furniture even when it sits well inside the page', () => {
    // Facsimile editions print a small page inside a large one, so the running
    // header can sit nowhere near the physical edge. What identifies it is that
    // it opens every page and says the same thing.
    const lines: Line[] = [];
    for (let page = 1; page <= 6; page++) {
      lines.push(line('CONSTITUTION OF THE UNITED STATES', { page, y: 579 }));
      lines.push(...filler(6, 540).map((l) => ({ ...l, page })));
    }
    const blocks = buildBlocks(lines, 792);
    const header = blocks.find((b) => b.text.startsWith('CONSTITUTION OF THE'));
    expect(header?.kind).toBe('furniture');
  });

  it('marks a contents line with dot leaders as furniture', () => {
    const blocks = buildBlocks(
      [...filler(20), line('Chapter One . . . . . . . 12', { y: 300 })],
      792,
    );
    expect(blocks[blocks.length - 1].kind).toBe('furniture');
  });
});

describe('buildBlocks line offsets', () => {
  it('reports where each line begins in the block text', () => {
    const blocks = buildBlocks(
      [line('The count had not', { y: 700 }), line('yet spoken at all.', { y: 686 }), ...filler(20)],
      792,
    );
    const [block] = blocks;
    expect(block.lineOffsets).toEqual([0, 'The count had not '.length]);
    expect(block.text.slice(block.lineOffsets[1])).toBe('yet spoken at all.');
  });

  it('accounts for a joined hyphen when reporting offsets', () => {
    const blocks = buildBlocks(
      [line('the extraordi-', { y: 700 }), line('nary events.', { y: 686 }), ...filler(20)],
      792,
    );
    const [block] = blocks;
    expect(block.text.slice(block.lineOffsets[1])).toBe('nary events.');
  });
});

describe('buildBlocks refinements', () => {
  it('drops a marginal line number set in small type', () => {
    const blocks = buildBlocks(
      [...filler(20), line('12', { y: 200, x: 20, width: 10, fontSize: 7 })],
      792,
    );
    expect(blocks.some((b) => b.text === '12' && b.kind !== 'furniture')).toBe(false);
  });

  it('keeps a number that is real body text', () => {
    // Sits in the middle of the page, so it is not a page number: those open or
    // close a page.
    const blocks = buildBlocks(
      [...filler(10, 700), line('42', { y: 500, fontSize: 10 }), ...filler(10, 400)],
      792,
    );
    expect(blocks.some((b) => b.text === '42' && b.kind === 'body')).toBe(true);
  });

  it('treats small type in the middle of the page as body, not a footnote', () => {
    // Some books set a passage -- a preamble, an epigraph, a long quotation --
    // smaller than the body. A footnote is small AND at the foot of the page.
    const blocks = buildBlocks(
      [line('A passage set smaller than the body text.', { y: 700, fontSize: 7.5 }), ...filler(20)],
      792,
    );
    const passage = blocks.find((b) => b.text.startsWith('A passage set'));
    expect(passage?.kind).toBe('body');
  });

  it('joins a heading that runs over several lines', () => {
    const blocks = buildBlocks(
      [
        line('THE CONSTITUTION', { y: 700, fontSize: 20 }),
        line('OF THE UNITED STATES', { y: 660, fontSize: 20 }),
        ...filler(20),
      ],
      792,
    );
    expect(blocks[0].kind).toBe('heading');
    expect(blocks[0].text).toBe('THE CONSTITUTION OF THE UNITED STATES');
  });
});

describe('buildBlocks does not delete prose', () => {
  it('keeps a prose line whose common words happen to repeat at the same height', () => {
    // Furniture is detected per item so one odd page cannot smuggle a footer
    // through. But a PDF emits a line as many small runs, and the short ones --
    // "I", "was", "and" -- recur at the same height on page after page in any
    // book. Counting those was enough to condemn a unique sentence and delete
    // it silently, which is the worst thing this pipeline can do.
    const words = (text: string, page: number, y: number): Line => {
      let x = 50;
      const items = text.split(' ').map((word) => {
        const item = { text: word, page, x, y, width: word.length * 5, height: 10, fontSize: 10 };
        x += word.length * 5 + 4;
        return item;
      });
      return { page, y, x: 50, width: x - 50, height: 10, fontSize: 10, text, items };
    };

    const sentences = [
      'I was hungry and the room had gone very quiet by then.',
      'She asked whether the money was already gone from the account.',
      'He said nothing at all for what felt like a long time.',
      'They wanted the deal closed before anyone else could bid.',
      'We had one hour left and no way to reach the building.',
      'The kidnappers called again just after midnight that night.',
    ];
    const lines: Line[] = [];
    sentences.forEach((text, i) => {
      const page = i + 1;
      lines.push(words(text, page, 700));
      lines.push(...filler(6, 640).map((l) => ({ ...l, page })));
    });

    const blocks = buildBlocks(lines, 792);
    const prose = blocks.find((b) => b.text.startsWith('I was hungry'));
    expect(prose?.kind).toBe('body');
  });
});

describe('buildBlocks tells an ellipsis from a contents leader', () => {
  it('keeps a sentence written with a spaced ellipsis', () => {
    // American typography sets an ellipsis at the end of a sentence as four
    // spaced dots. A contents leader runs far longer than that.
    const blocks = buildBlocks(
      [line('Actually, I was in love. . . . I never said so.', { y: 700 }), ...filler(20)],
      792,
    );
    expect(blocks[0].kind).toBe('body');
  });

  it('still drops a contents line whose leader runs the width of the page', () => {
    const blocks = buildBlocks(
      [...filler(20), line('Text of the Constitution . . . . . . . . . . . . 14', { y: 200 })],
      792,
    );
    expect(blocks[blocks.length - 1].kind).toBe('furniture');
  });
});
