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
