const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Signs release builds with a real key instead of the debug one.
 *
 * The template ships `signingConfig signingConfigs.debug` under `release`,
 * which builds something installable and undistributable: Play refuses a
 * debug-signed upload, and anything already installed with the debug key can
 * never be updated by a properly signed build.
 *
 * The key itself lives in android/keystore.properties, which is not committed.
 * Where that file is absent -- a fresh clone, or CI without the secret -- the
 * build falls back to the debug key rather than failing, so `assembleRelease`
 * still works for anyone testing.
 *
 * This is a config plugin because android/ is generated: an edit made there by
 * hand disappears at the next prebuild, silently, and the only symptom is an
 * APK signed with the wrong key.
 */
const CONFIG = `
        release {
            def keystoreProperties = new Properties()
            def keystorePropertiesFile = rootProject.file('keystore.properties')
            if (keystorePropertiesFile.exists()) {
                keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
                storeFile rootProject.file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
`;

const CHOOSE =
  "signingConfig rootProject.file('keystore.properties').exists() " +
  '? signingConfigs.release : signingConfigs.debug';

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let gradle = config.modResults.contents;

    if (!gradle.includes("rootProject.file('keystore.properties')")) {
      gradle = gradle.replace(
        /(signingConfigs \{\n)/,
        `$1${CONFIG}`,
      );
      gradle = gradle.replace(
        /signingConfig signingConfigs\.debug\n(\s*)def enableShrinkResources/,
        `${CHOOSE}\n$1def enableShrinkResources`,
      );
    }

    config.modResults.contents = gradle;
    return config;
  });
};
