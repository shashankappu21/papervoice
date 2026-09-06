import type { Line, TextItem } from './types';

/**
 * A list bullet: decoration a synthesiser would either name aloud ("black
 * circle") or choke on. Numbered markers are left alone -- "1." carries meaning
 * a bullet does not, and a reader saying "one" before each step is right. Dashes
 * are left alone too: a line opening with one is far more often speech
 * ("-- and then she left") than a list.
 */
const BULLET = /^[•‣▪▫●○◦⁃∙·■□❖✿¤*+]\s+/;

/** Baselines this close belong to the same line: PDFs jitter by fractions of a point. */
function tolerance(fontSize: number): number {
  return Math.max(1.5, fontSize * 0.3);
}

/** Groups text items into visual lines, in reading order. */
export function buildLines(items: TextItem[]): Line[] {
  const sorted = [...items].sort(
    (a, b) => a.page - b.page || b.y - a.y || a.x - b.x,
  );

  const groups: TextItem[][] = [];
  let current: TextItem[] = [];

  for (const item of sorted) {
    const previous = current[current.length - 1];
    const sameLine =
      previous !== undefined &&
      previous.page === item.page &&
      Math.abs(previous.y - item.y) <= tolerance(Math.min(previous.fontSize, item.fontSize));

    if (!sameLine && current.length > 0) {
      groups.push(current);
      current = [];
    }
    current.push(item);
  }
  if (current.length > 0) groups.push(current);

  return groups.map(toLine);
}

function toLine(group: TextItem[]): Line {
  const items = [...group].sort((a, b) => a.x - b.x);

  let text = '';
  let previous: TextItem | undefined;
  for (const item of items) {
    if (previous) {
      const gap = item.x - (previous.x + previous.width);
      const spaced = /\s$/.test(text) || /^\s/.test(item.text);
      // A gap wide enough to be a word space. Items split mid-word by kerning
      // sit flush against each other and must not gain one.
      if (!spaced && gap > item.fontSize * 0.25) text += ' ';
    }
    text += item.text;
    previous = item;
  }

  const left = Math.min(...items.map((i) => i.x));
  const right = Math.max(...items.map((i) => i.x + i.width));

  return {
    page: items[0].page,
    y: items[0].y,
    x: left,
    width: right - left,
    height: Math.max(...items.map((i) => i.height)),
    fontSize: dominantFontSize(items),
    text: stripBullet(text.replace(/\s+/g, ' ').trim()),
    items,
  };
}

/**
 * The size most of the line's characters are set in. A mean would be dragged
 * off by a drop cap or a superscript; the mode is what the line looks like.
 */
function dominantFontSize(items: TextItem[]): number {
  const weight = new Map<number, number>();
  for (const item of items) {
    const size = Math.round(item.fontSize * 2) / 2;
    weight.set(size, (weight.get(size) ?? 0) + item.text.length);
  }
  return [...weight.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Removes a leading list bullet. A line that is nothing but a bullet keeps it,
 * so the line does not vanish and leave a block starting mid-thought.
 */
function stripBullet(text: string): string {
  const stripped = text.replace(BULLET, '');
  return stripped.length > 0 ? stripped : text;
}
