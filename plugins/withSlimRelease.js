const {
  withAppBuildGradle,
  withDangerousMod,
  withGradleProperties,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Everything that makes the release build smaller.
 *
 * It lives in a config plugin rather than in the android/ directory because
 * that directory is generated: `expo prebuild` rewrites gradle.properties,
 * build.gradle and proguard-rules.pro, and a hand edit to any of them
 * disappears with nothing but a larger APK to notice it by.
 *
 * The release APK was 113 MB. Four things account for most of that, and each
 * is dealt with below.
 */

/** Gradle properties the generated build.gradle already reads. */
const PROPERTIES = {
  /*
   * R8. Shrinks the dex -- 48 MB of classes, of which the app uses a fraction
   * -- and strips unused resources with it. The keep rules below say what it
   *  must not touch.
   */
  'android.enableMinifyInReleaseBuilds': 'true',
  'android.enableShrinkResourcesInReleaseBuilds': 'true',

  /*
   * Compressed native libraries.
   *
   * The libraries are three quarters of the download: onnxruntime alone is
   * 37 MB, and stored uncompressed it is 37 MB of the APK. Compressed it is
   * closer to 12.
   *
   * The cost is real and worth stating. Uncompressed libraries are mapped
   * straight out of the APK; compressed ones are extracted at install time, so
   * the phone ends up holding both the APK and the unpacked copy. Disk use
   * comes out roughly level, install is slower, and the download -- which is
   * what someone actually waits for -- halves.
   *
   * The AAB build overrides this back to false. Play splits and recompresses
   * for transfer itself, and wants them uncompressed to do it.
   */
  'expo.useLegacyPackaging': 'true',
};

/**
 * Native libraries shipped by the sherpa-onnx AAR that nothing here loads.
 *
 * The AAR carries four. Our Kotlin talks to sherpa through its Java classes,
 * which means libsherpa-onnx-jni.so, and that library's NEEDED entries list
 * only libonnxruntime.so alongside the platform's own -- neither the C nor the
 * C++ API is referenced by anything that ends up running. They are 8.4 MB of
 * an interface for callers we do not have.
 */
const UNUSED_LIBS = ['**/libsherpa-onnx-c-api.so', '**/libsherpa-onnx-cxx-api.so'];

/**
 * What R8 must be told to leave alone.
 *
 * All of it is reached by name at runtime rather than by a call R8 can see:
 * JNI looks classes and methods up as strings, and Expo modules are found by
 * reflection over their annotations. A shrinker following only the call graph
 * has no reason to think any of it is used.
 */
const KEEP_RULES = `
# --- Papervoice: added by plugins/withSlimRelease.js ---

# sherpa-onnx. The native side looks these classes and their fields up by name;
# renaming or removing one turns into a crash inside the JNI, not a build error.
-keep class com.k2fsa.sherpa.onnx.** { *; }

# Anything with a native method, and the classes those methods are declared on.
-keepclasseswithmembernames,includedescriptorclasses class * {
    native <methods>;
}

# Expo modules are discovered by reflection over their annotations, and the
# generated module list names them as strings.
-keep class expo.modules.** { *; }
-keep @interface expo.modules.kotlin.** { *; }
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
`;

module.exports = function withSlimRelease(config) {
  config = withGradleProperties(config, (config) => {
    for (const [key, value] of Object.entries(PROPERTIES)) {
      config.modResults = config.modResults.filter(
        (item) => !(item.type === 'property' && item.key === key),
      );
      config.modResults.push({ type: 'property', key, value });
    }
    return config;
  });

  config = withAppBuildGradle(config, (config) => {
    let gradle = config.modResults.contents;

    /*
     * The excludes go inside packagingOptions.jniLibs rather than in the
     * gradle.properties list the template offers. That list feeds
     * packagingOptions.excludes, which under AGP 8 filters Java resources and
     * leaves .so files alone -- it would have looked like it worked.
     */
    if (!gradle.includes('libsherpa-onnx-c-api.so')) {
      const excludes = UNUSED_LIBS.map((lib) => `'${lib}'`).join(', ');
      gradle = gradle.replace(
        /(packagingOptions\s*\{\s*jniLibs\s*\{)/,
        `$1\n            excludes += [${excludes}]`,
      );
    }

    // English only. Every AndroidX library ships its strings in seventy-odd
    // languages, and the app itself is written in one.
    if (!gradle.includes('localeFilters')) {
      gradle = gradle.replace(
        /(androidResources\s*\{)/,
        `$1\n        localeFilters += ['en']`,
      );
    }

    config.modResults.contents = gradle;
    return config;
  });

  return withDangerousMod(config, [
    'android',
    (config) => {
      const file = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'proguard-rules.pro',
      );
      const existing = fs.readFileSync(file, 'utf8');
      if (!existing.includes('Papervoice: added by plugins/withSlimRelease.js')) {
        fs.writeFileSync(file, existing + KEEP_RULES);
      }
      return config;
    },
  ]);
};
