import { describe, expect, it } from 'vitest';
import { switchesNow } from '../src/player/voiceSwitch';

describe('a voice chosen in the Voices tab', () => {
  it('switches a book whose voice is loaded', () => {
    expect(switchesNow({ loaded: true, pending: 0, loadedId: 'lyra' }, 'kristin')).toBe(true);
  });

  it('loads nothing for a book restored at launch and not yet played', () => {
    // Fix 4's promise: no voice model until play is pressed.
    expect(switchesNow({ loaded: false, pending: 0, loadedId: null }, 'kristin')).toBe(false);
  });

  it('does nothing when it is already the voice in use', () => {
    expect(switchesNow({ loaded: true, pending: 0, loadedId: 'lyra' }, 'lyra')).toBe(false);
  });

  it('still switches while a load is in flight, since that load may be the old choice', () => {
    expect(switchesNow({ loaded: false, pending: 1, loadedId: null }, 'kristin')).toBe(true);
    expect(switchesNow({ loaded: true, pending: 1, loadedId: 'lyra' }, 'lyra')).toBe(true);
  });
});
