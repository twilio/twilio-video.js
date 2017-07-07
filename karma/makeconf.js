/* eslint no-process-env:0 */
'use strict';

function makeConf(defaultFile, browserNoActivityTimeout) {
  browserNoActivityTimeout = browserNoActivityTimeout || 30000;
  return function conf(config) {
    let files = [];
    if (process.env.FILE) {
      files = [process.env.FILE];
    } else if (config.files && config.files.length) {
      files = config.files;
    } else if (defaultFile) {
      files = [defaultFile];
    }

    const preprocessors = files.reduce((preprocessors, file) => {
      return Object.assign({ [file]: 'browserify' });
    }, {});

    const browsers = {
      chrome: ['ChromeWebRTC'],
      firefox: ['FirefoxWebRTC']
    }[process.env.BROWSER] || ['ChromeWebRTC', 'FirefoxWebRTC'];

    config.set({
      basePath: '',
      frameworks: ['browserify', 'mocha'],
      files,
      preprocessors,
      browserify: {
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
      browserNoActivityTimeout,
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
}

module.exports = makeConf;
