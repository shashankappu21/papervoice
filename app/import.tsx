/**
 * A route that is never navigated to.
 *
 * The centre tab opens a file picker instead of a screen, but expo-router
 * builds its tabs from the files here, so the slot needs a file to exist. The
 * tab's own button intercepts the press; nothing below ever renders.
 */
export default function ImportRoute() {
  return null;
}
