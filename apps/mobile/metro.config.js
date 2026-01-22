// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configure SVG support with react-native-svg-transformer
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

config.resolver = {
  ...config.resolver,
  assetExts: config.resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...config.resolver.sourceExts, 'svg'],
  // Block web-only testing packages from being bundled
  blockList: [
    /.*\/node_modules\/jsdom\/.*/,
    /.*\/node_modules\/\.pnpm\/jsdom@.*/,
    /.*\/node_modules\/happy-dom\/.*/,
    /.*\/node_modules\/\.pnpm\/happy-dom@.*/,
    /.*\/node_modules\/vitest\/.*/,
    /.*\/node_modules\/\.pnpm\/vitest@.*/,
    /.*\/node_modules\/@vitest\/.*/,
    /.*\/node_modules\/\.pnpm\/@vitest.*/,
    /.*\/node_modules\/@testing-library\/react\/.*/,
    /.*\/node_modules\/@testing-library\/jest-dom\/.*/,
  ],
};

module.exports = config;
