import { useEffect, useState } from 'react';
import { ExtractorWebView } from '../extraction/ExtractorWebView';
import { booksNeedingDetails, setBookCover, setBookOutline, type Book } from '../db/books';

/**
 * Gives older books the details later versions record at import.
 *
 * One at a time and quietly. Only page one is read, so this is a fraction of
 * the work an import does -- but a library of twenty books would still be
 * twenty PDFs opened at once if it were done in parallel, on a phone, while
 * someone is trying to read.
 */
export function CoverBackfill({ onDone }: { onDone: () => void }) {
  const [queue, setQueue] = useState<Book[] | null>(null);
  const [at, setAt] = useState(0);

  useEffect(() => {
    booksNeedingDetails().then(setQueue, () => setQueue([]));
  }, []);

  const book = queue?.[at] ?? null;

  const next = () => {
    setAt((current) => {
      const following = current + 1;
      if (queue && following >= queue.length) onDone();
      return following;
    });
  };

  if (!book) return null;

  return (
    <ExtractorWebView
      // Remounts per book, so pdf.js starts clean rather than holding the
      // previous document open.
      key={book.id}
      uri={book.uri}
      mode="cover"
      onCover={(cover, outline) => {
        // The outline is written even when empty: null means never looked
        // for, and without the distinction every book without one would be
        // re-opened on every launch.
        const work = [setBookOutline(book.id, outline)];
        if (cover) work.push(setBookCover(book.id, cover).then(() => undefined));
        void Promise.all(work).then(next, next);
      }}
      onDone={next}
      onError={next}
    />
  );
}
