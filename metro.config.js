// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// pdf.js is vendored under assets/pdfjs/ with a .txt extension so Metro treats
// it as an asset rather than trying to parse it as application source. The
// extractor WebView copies those files out and loads them from disk.
config.resolver.assetExts.push('txt');

// The voice samples are Opus, which Metro does not treat as an asset by
// default -- it knows mp3, m4a, wav and a few others, but not this one. Opus
// is worth the extra line: the samples are a fifth the size of the same speech
// as AAC, and Android has played it since well before the oldest version this
// app supports.
config.resolver.assetExts.push('opus');

module.exports = config;
