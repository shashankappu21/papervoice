// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// pdf.js is vendored under assets/pdfjs/ with a .txt extension so Metro treats
// it as an asset rather than trying to parse it as application source. The
// extractor WebView copies those files out and loads them from disk.
config.resolver.assetExts.push('txt');

module.exports = config;
