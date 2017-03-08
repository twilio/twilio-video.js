module.exports = (config) => {
  config.set({
    basePath: '',
    frameworks: ['browserify', 'mocha'],
    files: [
      'test/webrtc.js'
    ],
    preprocessors: {
      'test/webrtc.js': ['browserify']
    },
    reporters: ['spec'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['ChromeWebRTC', 'FirefoxWebRTC'],
    singleRun: true,
    concurrency: 1,
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
  })
}
