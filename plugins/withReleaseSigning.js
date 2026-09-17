const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Signs release builds with a real key instead of the debug one.
 *
 * The template ships `signingConfig signingConfigs.debug` under `release`,
 * which builds something installable and undistributable: Play refuses a
 * debug-signed upload, and anything already installed with the debug key can
 * never be updated by a properly signed build.
 *
 * The key lives in keys/ at the repository root, which is not committed.
 * Where keys/keystore.properties is absent -- a fresh clone, or CI without the
 * secret -- the build falls back to the debug key rather than failing, so
 * `assembleRelease` still works for anyone testing. The release scripts refuse
 * to run in that state, because for them it is never what was meant.
 *
 * Not in android/, where it used to be. android/ is generated, and
 * `expo prebuild` recreates it -- without --clean, too -- taking anything that
 * was put there by hand. It took the keystore once, and only a backup meant
 * that cost nothing. This is the one file in the project that cannot be
 * replaced: Play and every sideloaded install are tied to it.
 *
 * This is a config plugin for the same reason: an edit made in android/ by
 * hand disappears at the next prebuild, silently, and the only symptom is an
 * APK signed with the wrong key.
 */
const PROPERTIES = "rootProject.file('../keys/keystore.properties')";

const CONFIG = `
        release {
            def keystoreProperties = new Properties()
            def keystorePropertiesFile = ${PROPERTIES}
            if (keystorePropertiesFile.exists()) {
                keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
                // Relative to the properties file, so the two travel together.
                storeFile new File(keystorePropertiesFile.parentFile, keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
`;

const CHOOSE =
  `signingConfig ${PROPERTIES}.exists() ` + '? signingConfigs.release : signingConfigs.debug';

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let gradle = config.modResults.contents;

    if (!gradle.includes(PROPERTIES)) {
      gradle = gradle.replace(/(signingConfigs \{\n)/, `$1${CONFIG}`);
      gradle = gradle.replace(
        /signingConfig signingConfigs\.debug\n(\s*)def enableShrinkResources/,
        `${CHOOSE}\n$1def enableShrinkResources`,
      );
    }

    config.modResults.contents = gradle;
    return config;
  });
};
