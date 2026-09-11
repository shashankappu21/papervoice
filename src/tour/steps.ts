/**
 * The guided tours.
 *
 * Two of them, each confined to one screen. A single tour walking across
 * screens would have to drive the navigation itself, and a reader who wandered
 * off mid-way would be left with an overlay pointing at something that is no
 * longer there.
 *
 * Every step points at a real control and leaves it pressable, so the tour is
 * something you do rather than something you watch.
 */

/** Where a step's spotlight goes. Registered by the screen that owns it. */
export type TargetId =
  | 'import'
  | 'groups'
  | 'voicesTab'
  | 'settings'
  | 'play'
  | 'voice'
  | 'speed'
  | 'contents';

export interface Step {
  /** Null shows a plain message over a dimmed screen. */
  target: TargetId | null;
  title: string;
  body: string;
  /**
   * What to do when the control is not on the screen.
   *
   * 'skip' for a step that makes no sense without it -- there is nothing to
   * say about jumping to a chapter in a book that has none. 'show' for a step
   * worth making anyway: the group chips do not exist until there is a book to
   * put in one, and a reader opening the app for the first time has none, yet
   * that is exactly who most needs telling the feature is there.
   */
  whenMissing?: 'skip' | 'show';
}

export type TourId = 'library' | 'reader';

export const TOURS: Record<TourId, Step[]> = {
  library: [
    {
      target: null,
      title: 'Papervoice reads your books aloud',
      body:
        'Import a PDF and listen to it like an audiobook, following along as each sentence is read. All of it happens on this phone — nothing you read is ever uploaded.',
    },
    {
      target: 'import',
      title: 'Add a book',
      body:
        'Tap the plus to bring in a PDF. You can also open one straight from your file manager and choose Papervoice.',
    },
    {
      target: 'groups',
      whenMissing: 'show',
      title: 'Keep them in groups',
      body:
        'Make groups of your own — by subject, by course, by whatever you like. A book can be in several at once, or in none.',
    },
    {
      target: 'voicesTab',
      title: 'Pick a voice',
      body:
        'Your phone already has a voice, and better ones can be downloaded. Listen to a sample of each before you spend the download.',
    },
    {
      target: 'settings',
      title: 'Make it comfortable',
      body: 'Light, dark or paper, and the text as large as you want it.',
    },
  ],

  reader: [
    {
      target: 'play',
      title: 'Press play',
      body:
        'The sentence being spoken is highlighted, and the page follows along. Tap any sentence to jump there.',
    },
    {
      target: 'voice',
      title: 'Change the voice',
      body: 'Any voice you have downloaded, swapped mid-book without losing your place.',
    },
    {
      target: 'speed',
      title: 'Change the speed',
      body: 'Drag it, or pick one of the usual speeds. It is remembered for every book.',
    },
    {
      target: 'contents',
      whenMissing: 'skip',
      title: 'Jump to a chapter',
      body:
        'Where the PDF has contents of its own, this uses them. Where it has not, it uses the headings found in the text.',
    },
  ],
};

/** Settings keys, one per tour, so finishing one does not hide the other. */
export const seenKey = (tour: TourId): string => `tour.${tour}.seen`;
