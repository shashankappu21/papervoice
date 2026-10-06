const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

/**
 * Builds the icon font into the APK, so icons are drawn on the first frame.
 *
 * @expo/vector-icons loads its font at runtime. Each icon asks
 * Font.isLoaded('ionicons') when it is created; until that is true it renders
 * an empty <Text />, starts Font.loadAsync, and draws the glyph only when the
 * load resolves. On a cold start that was a second or two of a tab bar with no
 * icons in it.
 *
 * A font in the APK's assets/fonts/ is different: expo-font reports it loaded
 * synchronously, before any JavaScript asks. But Android takes the family name
 * from the FILE NAME, case-sensitively -- and the library asks for `ionicons`
 * while shipping `Ionicons.ttf`. Embedded under its own name it would register
 * as "Ionicons", the check for "ionicons" would still fail, and nothing would
 * change. So it is copied in under the name the library actually uses.
 *
 * Copied from the installed package at prebuild rather than committed: the
 * glyph map lives in the JavaScript, and a stale copy of the font beside a
 * newer map would draw the wrong icons rather than none.
 *
 * Costs about 380KB of APK, since the bundled JavaScript still carries its own
 * copy for the runtime path.
 */
const SOURCE = '@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf';

/** The family name @expo/vector-icons asks for: createIconSet(glyphMap, 'ionicons', font). */
const FAMILY = 'ionicons';

/** Copies the font into an Android project. Separate so it can be tested. */
function embedIconFont(projectRoot, androidRoot) {
  const source = require.resolve(SOURCE, { paths: [projectRoot] });
  const fonts = path.join(androidRoot, 'app', 'src', 'main', 'assets', 'fonts');
  fs.mkdirSync(fonts, { recursive: true });
  const target = path.join(fonts, `${FAMILY}.ttf`);
  fs.copyFileSync(source, target);
  return target;
}

function withIconFont(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      embedIconFont(config.modRequest.projectRoot, config.modRequest.platformProjectRoot);
      return config;
    },
  ]);
}

module.exports = withIconFont;
module.exports.embedIconFont = embedIconFont;
module.exports.FAMILY = FAMILY;
module.exports.SOURCE = SOURCE;
