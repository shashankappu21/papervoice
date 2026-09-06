const { withGradleProperties } = require('expo/config-plugins');

/**
 * Builds only for the ABI the development phone uses, which roughly halves
 * native build time.
 *
 * This lives in a config plugin rather than in android/gradle.properties
 * because that directory is generated: `expo prebuild` rewrites it and a hand
 * edit disappears silently, with nothing but a slower build to notice it by.
 *
 * REMOVE THIS BEFORE THE FIRST STORE RELEASE. The app ships as an AAB and Play
 * generates per-ABI splits, so restoring armeabi-v7a costs arm64 users nothing
 * in download size while keeping the app installable on older phones.
 */
module.exports = function withDevAbi(config, { architectures = 'arm64-v8a' } = {}) {
  return withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      (item) => !(item.type === 'property' && item.key === 'reactNativeArchitectures'),
    );
    config.modResults.push({
      type: 'property',
      key: 'reactNativeArchitectures',
      value: architectures,
    });
    return config;
  });
};
