import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * How much of the screen the keyboard is covering.
 *
 * Android is asked to resize the window when the keyboard appears, and it
 * does -- but a React Native Modal is its own window and is never resized with
 * it. So a sheet anchored to the bottom stays exactly where it was, under the
 * keyboard, along with whatever is being typed into it. Measuring the keyboard
 * and lifting the sheet ourselves is the way out of that.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // iOS announces the keyboard before it moves, which allows the sheet to
    // travel with it. Android only says so afterwards.
    const shown = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hidden = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(shown, (event) =>
      setHeight(event.endCoordinates?.height ?? 0),
    );
    const hide = Keyboard.addListener(hidden, () => setHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
