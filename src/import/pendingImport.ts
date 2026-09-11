/**
 * A document handed over by Android, waiting for the app to be ready for it.
 *
 * The two ends of this cannot talk directly. Android delivers the uri to
 * `app/+native-intent.tsx`, which is a module the router calls before any
 * screen exists; the thing that imports it is a provider inside the tree. So
 * the uri is left here, and collected once there is something to collect it.
 *
 * It is a module rather than a context because the first end runs before any
 * context does.
 */

let waiting: string | null = null;
const listeners = new Set<(uri: string) => void>();

/** Called by the router when a document arrives. */
export function offerImport(uri: string): void {
  // Told directly where anything is listening, so a document arriving while
  // the app is open is not held until something asks.
  if (listeners.size > 0) {
    for (const listener of listeners) listener(uri);
    return;
  }
  waiting = uri;
}

/**
 * Listens for documents, and is given anything that arrived before it existed.
 * Returns the function that stops listening.
 */
export function onImportOffered(listener: (uri: string) => void): () => void {
  listeners.add(listener);

  if (waiting !== null) {
    const uri = waiting;
    waiting = null;
    listener(uri);
  }

  return () => {
    listeners.delete(listener);
  };
}
