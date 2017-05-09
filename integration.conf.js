module.exports = (config) => {
  const files = config.files && config.files.length
    ? config.files
    : ['test/integration/index.js'];
  const browsers = {
    chrome: ['ChromeWebRTC'],
    firefox: ['FirefoxWebRTC']
  }[process.env.BROWSER] || ['ChromeWebRTC', 'FirefoxWebRTC'];
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
        'envify'
      ]
    },
    reporters: ['spec'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_DEBUG,
    autoWatch: true,
    browsers,
    singleRun: true,
    concurrency: 1,
    browserNoActivityTimeout: 120000,
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
