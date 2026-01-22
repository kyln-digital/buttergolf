module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@buttergolf/ui': '../../packages/ui/src',
          },
        },
      ],
      // Tamagui babel plugin for native optimizations
      [
        '@tamagui/babel-plugin',
        {
          components: ['tamagui', '@buttergolf/ui'],
          // Use the shared Tamagui config used by both Web (Next plugin) and Mobile
          config: '../../packages/config/src/tamagui.config.ts',
          logTimings: true,
          disableExtraction: process.env.NODE_ENV === 'development',
        },
      ],
    ],
  }
}
