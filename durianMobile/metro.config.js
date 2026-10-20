const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Model files are bundled as assets (see src/ai/bundled.ts).
config.resolver.assetExts.push('onnx', 'ort');

module.exports = config;
