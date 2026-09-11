import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getSetting, setSetting } from '../db/settings';
import { seenKey, TOURS, type TargetId, type TourId } from './steps';
import type { Rect } from './spotlight';

interface TourContextValue {
  /** The tour running now, or null. */
  tour: TourId | null;
  step: number;
  /** Where each registered control is, in screen coordinates. */
  targets: Partial<Record<TargetId, Rect>>;
  register(id: TargetId, rect: Rect | null): void;
  /** Offers a tour; it runs only if it has never been finished. */
  offer(tour: TourId): void;
  next(): void;
  finish(): void;
  /** Forgets that the tours were seen, so they run again. */
  replay(): Promise<void>;
}

const TourContext = createContext<TourContextValue | null>(null);

/**
 * Runs the guided tours.
 *
 * Controls report where they are as they lay out, and the tour reads that
 * registry rather than hunting for them. A step whose control has not
 * reported yet simply waits: the alternative is a spotlight on the top-left
 * corner of the screen while the layout settles, which looks broken.
 */
export function TourProvider({ children }: { children: React.ReactNode }) {
  const [tour, setTour] = useState<TourId | null>(null);
  const [step, setStep] = useState(0);
  const [targets, setTargets] = useState<Partial<Record<TargetId, Rect>>>({});

  /** Tours already finished, so one is never offered twice in a session. */
  const seen = useRef(new Set<TourId>());
  const asked = useRef(new Set<TourId>());

  const register = useCallback((id: TargetId, rect: Rect | null) => {
    setTargets((current) => {
      const existing = current[id];
      if (!rect) {
        if (!existing) return current;
        const next = { ...current };
        delete next[id];
        return next;
      }
      // Layout fires often and mostly with the same numbers; replacing the
      // object every time would re-render the overlay on every frame.
      if (
        existing &&
        Math.abs(existing.x - rect.x) < 1 &&
        Math.abs(existing.y - rect.y) < 1 &&
        Math.abs(existing.width - rect.width) < 1 &&
        Math.abs(existing.height - rect.height) < 1
      ) {
        return current;
      }
      return { ...current, [id]: rect };
    });
  }, []);

  const finish = useCallback(() => {
    setTour((running) => {
      if (running) {
        seen.current.add(running);
        void setSetting(seenKey(running), 'yes').catch(() => undefined);
      }
      return null;
    });
    setStep(0);
  }, []);

  const next = useCallback(() => {
    setStep((at) => {
      const steps = tour ? TOURS[tour].length : 0;
      if (at + 1 >= steps) {
        finish();
        return 0;
      }
      return at + 1;
    });
  }, [tour, finish]);

  const offer = useCallback((wanted: TourId) => {
    if (asked.current.has(wanted) || seen.current.has(wanted)) return;
    asked.current.add(wanted);

    getSetting(seenKey(wanted)).then(
      (stored) => {
        if (stored) {
          seen.current.add(wanted);
          return;
        }
        setStep(0);
        // Only one tour at a time; a reader who opens a book mid-tour gets
        // the reader's tour the next time they open one.
        setTour((running) => running ?? wanted);
      },
      // A settings table that will not answer should not mean showing the
      // tour on every launch for ever.
      () => seen.current.add(wanted),
    );
  }, []);

  const replay = useCallback(async () => {
    // Both the stored flag and the guard kept for this session. Clearing only
    // the first would mean the tour returning after a restart rather than now,
    // which is not what "show me around again" says.
    seen.current.clear();
    asked.current.clear();
    await Promise.all([
      setSetting(seenKey('library'), '').catch(() => undefined),
      setSetting(seenKey('reader'), '').catch(() => undefined),
    ]);
  }, []);

  const value = useMemo<TourContextValue>(
    () => ({ tour, step, targets, register, offer, next, finish, replay }),
    [tour, step, targets, register, offer, next, finish, replay],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const found = useContext(TourContext);
  if (!found) throw new Error('useTour was called outside TourProvider.');
  return found;
}

/**
 * Offers a tour once the screen showing it exists.
 *
 * Called by the screen rather than by the provider, because only the screen
 * knows when it is actually on display.
 */
export function useOfferTour(wanted: TourId, ready = true): void {
  const { offer } = useTour();
  useEffect(() => {
    if (ready) offer(wanted);
  }, [wanted, ready, offer]);
}
