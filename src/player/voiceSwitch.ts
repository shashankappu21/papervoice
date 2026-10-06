/**
 * Whether a voice chosen outside the reader should switch the playing book now.
 *
 * Kept pure so the rule is tested without a device. It is the line between two
 * things that must both stay true: a voice chosen in the Voices tab is heard on
 * the book being listened to, and a book restored to the bar at launch does not
 * load a voice model until play is pressed.
 */
export interface VoiceState {
  /** A voice model is loaded right now. */
  loaded: boolean;
  /** Loads asked for and not yet finished, queued ones included. */
  pending: number;
  /** The voice that is loaded, when one is. */
  loadedId: string | null;
}

export function switchesNow(state: VoiceState, chosen: string): boolean {
  // Nothing loaded and nothing on the way: the choice is saved, and play()
  // loads it when someone actually wants to listen.
  if (!state.loaded && state.pending === 0) return false;

  // Already the voice in use, with nothing pending that could replace it.
  if (state.pending === 0 && state.loadedId === chosen) return false;

  // Either a different voice is loaded, or a load is in flight -- and that load
  // read the setting before this choice was made, so it may be the old voice.
  return true;
}
