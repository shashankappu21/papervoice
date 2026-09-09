import { useEffect, useState } from 'react';
import { ExtractorWebView } from '../extraction/ExtractorWebView';
import { booksWithoutCovers, setBookCover, type Book } from '../db/books';

/**
 * Gives books imported before covers existed a picture.
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
    booksWithoutCovers().then(setQueue, () => setQueue([]));
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
      onCover={(cover) => {
        if (cover) void setBookCover(book.id, cover).then(next, next);
        else next();
      }}
      onDone={next}
      onError={next}
    />
  );
}
