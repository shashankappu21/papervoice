/** One text run as pdf.js reports it, already flattened to page coordinates. */
export interface TextItem {
  text: string;
  page: number;
  /** PDF user-space: x from left, y from BOTTOM of page. */
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

export interface BBox {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Sentence {
  /** Index within the document, 0-based. Stable: this is the position key. */
  index: number;
  /**
   * What this sentence is. A heading is read as its own utterance; a note is
   * read only if the listener asks for footnotes. Page furniture never becomes
   * a sentence at all.
   */
  kind: 'heading' | 'body' | 'note';
  /** Normalized text handed to the TTS engine. */
  text: string;
  /**
   * Union of the boxes of every item contributing to this sentence. Multiple
   * boxes because a sentence can wrap lines or cross a page. Kept from day one
   * so the "view original page" reader is additive, not a re-extraction.
   */
  boxes: BBox[];
}

export interface ExtractedDoc {
  sentences: Sentence[];
  pageCount: number;
}

/**
 * One visual line of text: every item sharing a baseline on a page, in reading
 * order. Lines are the unit layout decisions are made on, because font size and
 * vertical spacing only mean anything once items are grouped this way.
 */
export interface Line {
  page: number;
  /** Baseline, in PDF user space: measured from the BOTTOM of the page. */
  y: number;
  x: number;
  width: number;
  height: number;
  /** The size most of the line's characters are set in. */
  fontSize: number;
  text: string;
  items: TextItem[];
}

/**
 * What a run of lines is for. Playback treats these differently: body is read,
 * a heading is read as its own utterance, a note can be skipped, and furniture
 * is never read at all.
 */
export type BlockKind = 'heading' | 'body' | 'note' | 'furniture';

/** A run of lines that belong together and share one purpose. */
export interface Block {
  kind: BlockKind;
  /** Page the block starts on. A body block may continue onto the next. */
  page: number;
  text: string;
  lines: Line[];
  /**
   * Where each line starts in `text`, so a span of the block can be traced back
   * to the lines -- and therefore the boxes -- that produced it.
   */
  lineOffsets: number[];
}

