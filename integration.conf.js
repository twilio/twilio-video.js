module.exports = (config) => {
  const files = config.files && config.files.length
    ? config.files
    : ['test/integration/index.js'];
  config.set({
    basePath: '',
    frameworks: ['browserify', 'mocha'],
    files,
    preprocessors: files.reduce((files, file) => {
      files[file] = ['browserify'];
      return files;
    }, {}),
    browserify: {
      debug: true,
      transform: [
        'envify',
        ['babelify', {
          presets: ['es2015', 'es2017'],
          plugins: [
            ['transform-runtime', {
              polyfill: false,
              regenerator: true
            }]
          ]
        }]
      ]
    },
    reporters: ['spec'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_DEBUG,
    autoWatch: true,
    browsers: ['ChromeWebRTC', 'FirefoxWebRTC'],
    singleRun: true,
    concurrency: 1,
    browserNoActivityTimeout: 60000,
    customLaunchers: {
      ChromeWebRTC: {
        base: 'Chrome',
        flags: [
          '--use-fake-device-for-media-stream',
          '--use-fake-ui-for-media-stream'
        ]
      },
      FirefoxWebRTC: {
        base: 'Firefox',
        prefs: {
          'media.gstreamer.enabled': false,
          'media.navigator.permission.disabled': true,
          'media.navigator.streams.fake': true
        }
      }
    }
  });
};
