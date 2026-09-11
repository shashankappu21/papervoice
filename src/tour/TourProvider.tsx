import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useFocusEffect } from 'expo-router';
import { getSetting, setSetting } from '../db/settings';
import { seenKey, TOURS, type TargetId, type TourId } from './steps';
import type { Rect } from './spotlight';

interface TourContextValue {
  /** The tour running now, or null. */
  tour: TourId | null;
  /** Changes when the tours are replayed, to re-run the offers. */
  generation: number;
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
  /** Bumped by replay, so screens already on display offer their tour again. */
  const [generation, setGeneration] = useState(0);

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
    // Screens are already mounted, so nothing would offer a tour again on its
    // own: a tab that never unmounts never runs its mount effect twice.
    setGeneration((count) => count + 1);
    await Promise.all([
      setSetting(seenKey('library'), '').catch(() => undefined),
      setSetting(seenKey('reader'), '').catch(() => undefined),
    ]);
  }, []);

  const value = useMemo<TourContextValue>(
    () => ({ tour, generation, step, targets, register, offer, next, finish, replay }),
    [tour, generation, step, targets, register, offer, next, finish, replay],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const found = useContext(TourContext);
  if (!found) throw new Error('useTour was called outside TourProvider.');
  return found;
}

/**
 * Offers a tour whenever the screen showing it comes into view.
 *
 * On focus rather than on mount. A tab stays mounted once visited, so a mount
 * effect runs exactly once for the life of the app -- which meant "show me
 * around again" cleared the flags and then nothing ever asked again.
 *
 * Focus also settles the other half of it: replaying from Settings should not
 * start a tour pointing at controls behind the Settings sheet. The library
 * only regains focus once that sheet is closed.
 */
export function useOfferTour(wanted: TourId, ready = true): void {
  const { offer, generation } = useTour();

  useFocusEffect(
    useCallback(() => {
      if (ready) offer(wanted);
      // generation is not used in the body; it is here so that replaying
      // re-runs this on a screen that never left the foreground.
    }, [wanted, ready, offer, generation]),
  );
}
