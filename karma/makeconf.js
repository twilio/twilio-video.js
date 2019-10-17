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
      electron: ['ElectronWebRTC'],
      firefox: ['FirefoxWebRTC'],
      safari: ['Safari']
    };

    if (process.env.BROWSER) {
      browsers = browsers[process.env.BROWSER];
      if (!browsers) {
        throw new Error('Unknown browser');
      }
    } else if (process.platform === 'darwin') {
      browsers = ['ChromeWebRTC', 'ElectronWebRTC', 'FirefoxWebRTC', 'Safari'];
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
      reporters: ['spec', 'junit', 'html'],
      htmlReporter: { // configuration for karma-htmlfile-reporter
        outputFile: htmlReport,
        pageTitle: 'twilio-video.js Integration Tests',
        subPageTitle: strReportName,
        groupSuites: true,
        useCompactStyle: true,
        useLegacyStyle: true,
        showOnlyFailed: false, // switch this to true to only collect failures in the report files.
      },
      junitReporter: {
        outputDir: '../logs', // results will be saved as $outputDir/$browserName.xml
        outputFile: strReportName + '.xml', // if included, results will be saved as $outputDir/$browserName/$outputFile
        suite: '', // suite will become the package name attribute in xml testsuite element
        useBrowserName: true, // add browser name to report and classes names
        nameFormatter: undefined, // function (browser, result) to customize the name attribute in xml testcase element
        classNameFormatter: undefined, // function (browser, result) to customize the classname attribute in xml testcase element
        properties: {}, // key value pair of properties to add to the <properties> section of the report
        xmlVersion: null // use '1' if reporting to be per SonarQube 6.2 XML format
      },
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
        ElectronWebRTC: {
          base: 'Electron',
          flags: ['--default-user-agent']
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
