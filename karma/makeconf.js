/* eslint no-process-env:0 */
'use strict';

function makeConf(defaultFile, browserNoActivityTimeout, requires) {
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

    let browsers = {
      chrome: ['ChromeWebRTC'],
      firefox: ['FirefoxWebRTC'],
      safari: ['Safari']
    };

    if (process.env.BROWSER) {
      browsers = browsers[process.env.BROWSER];
      if (!browsers) {
        throw new Error('Unknown browser');
      }
    } else if (process.platform === 'darwin') {
      browsers = ['ChromeWebRTC', 'FirefoxWebRTC', 'Safari'];
    } else {
      browsers = ['ChromeWebRTC', 'FirefoxWebRTC'];
    }

    config.set({
      basePath: '',
      frameworks: ['browserify', 'mocha'],
      client: {
        mocha: {
          require: requires
        }
      },
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
      autoWatch: true,
      browsers,
      singleRun: true,
      concurrency: 1,
      browserNoActivityTimeout,
      customLaunchers: {
        ChromeWebRTC: {
          base: 'Chrome',
          flags: [
            '--autoplay-policy=no-user-gesture-required',
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream'
          ]
        },
        FirefoxWebRTC: {
          base: 'Firefox',
          prefs: {
            'media.gstreamer.enabled': false,
            'media.navigator.permission.disabled': true,
            'media.navigator.streams.fake': true,
            'media.autoplay.enabled.user-gestures-needed': false,
            'media.block-autoplay-until-in-foreground': false
          }
        }
      }
    });
  };
}

module.exports = makeConf;
