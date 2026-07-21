/* eslint-disable no-undefined */
/* eslint no-process-env:0 */
'use strict';

const isDocker = require('is-docker')();
const { basename, resolve: resolvePath } = require('path');

function getTestFiles(config, defaultFile) {
  let files = [];
  if (config.files && config.files.length) {
    files = config.files;
  } else if (defaultFile) {
    files = [defaultFile];
  }
  return files;
}

/**
 * Mint a fresh vendor OIDC token on demand, so the browser-side test suite never
 * runs on a single token past GitHub Actions' ~5 minute OIDC token lifetime.
 * Falls back to VENDOR_TOKEN as-is when no runner OIDC request token is present
 * (local runs with DISABLE_OIDC_CHECK=true).
 * @returns {Promise<string>}
 */
async function mintVendorToken() {
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  if (!requestToken || !requestUrl) {
    return process.env.VENDOR_TOKEN;
  }
  const audience = encodeURIComponent(process.env.VENDOR_AUDIENCE);
  const response = await fetch(`${requestUrl}&audience=${audience}`, {
    headers: { Authorization: `bearer ${requestToken}` }
  });
  if (!response.ok) {
    throw new Error(`OIDC token request failed: ${response.status}`);
  }
  const body = await response.json();
  return body.value;
}

function createMintVendorTokenMiddleware() {
  return function(request, response, next) {
    if (request.url !== '/mint-vendor-token') {
      next();
      return;
    }
    mintVendorToken().then(token => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ token }));
    }, error => {
      response.writeHead(500, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: error.message }));
    });
  };
}

let testRun = 0;
function generateReportName(files) {
  const strTestRun = (testRun++).toString();

  // generate reportname like: DOCKER-true-BROWSER-chrome-BVER-beta-TOPOLOGY-group-2
  let strReportName = `DO-${isDocker}-`;
  ['BROWSER', 'BVER', 'TOPOLOGY'].forEach(dim => {
    if (process.env[dim]) {
      const dimAbrr = dim.substr(0, 2);
      strReportName += `-${dimAbrr}-${process.env[dim]}`;
    }
  });

  if (files.length === 1) {
    // when testing single files include its name in the report.
    strReportName += '-FILE-' + basename(files[0], '.js');
  } else {
    // otherwise include uniq test run number.
    strReportName += '-' + strTestRun;
  }

  return strReportName;
}

function makeConf(defaultFile, browserNoActivityTimeout, requires) {
  browserNoActivityTimeout = browserNoActivityTimeout || 60000;
  if (isDocker) {
    // things go slow in docker for network tests
    browserNoActivityTimeout = 4 * 60 * 10000;
  }

  return function conf(config) {
    const files = getTestFiles(config, defaultFile);
    const preprocessors = files.reduce((preprocessors, file) => {
      return Object.assign({ [file]: 'browserify' });
    }, {});

    let browsers = {
      chrome: [isDocker ? 'ChromeInDocker' : 'ChromeWebRTC'],
      edge: ['EdgeWebRTC'],
      electron: ['ElectronWebRTC'],
      firefox: [isDocker ? 'FirefoxInDocker' : 'FirefoxWebRTC'],
      safari: ['Safari']
    };

    if (process.env.BROWSER) {
      browsers = browsers[process.env.BROWSER];
      if (!browsers) {
        throw new Error('Unknown browser');
      }
    } else if (isDocker) {
      browsers = ['ChromeInDocker', 'FirefoxInDocker'];
    } else if (process.platform === 'darwin') {
      browsers = ['ChromeWebRTC', 'EdgeWebRTC', 'ElectronWebRTC', 'FirefoxWebRTC', 'Safari'];
    } else {
      browsers = ['ChromeWebRTC', 'FirefoxWebRTC'];
    }

    const mochaOptions = {
      require: requires,
      bail: false, // when set to true this would fail the run after 1st test failure.
    };

    // we'll mark our unstable tests with @unstable
    switch  (process.env.TEST_STABILITY) {
      case 'unstable':
        mochaOptions.grep = '@unstable';
        break;
      case 'stable':
        mochaOptions.grep = '@unstable';
        mochaOptions.invert = 1;
        break;
      case 'all':
        // when no grep specified, all tests will run.
        break;
    }

    const strReportName = generateReportName(files);


    const hostedFiles = resolvePath('./test/assets/noisecancellation/**/*');
    files.push(
      // these files will be served on demand from disk and will be ignored by the watcher
      { pattern: hostedFiles, included: false, served: true, watched: false, nocache: true }
    );

    const htmlReport = `../logs/${strReportName}.html`;
    config.set({
      basePath: '',
      frameworks: ['browserify', 'mocha'],
      plugins: ['karma-*', { 'middleware:mintVendorToken': ['factory', createMintVendorTokenMiddleware] }],
      beforeMiddleware: ['mintVendorToken'],
      client: {
        mocha: mochaOptions
      },
      failOnEmptyTestSuite: false,
      files,
      preprocessors,
      proxies: {
        // create a proxy to serve hosted noise cancellation sdk files
        '/noisecancellation/': '/absolute' + resolvePath('./test/assets/noisecancellation'),
        '/static/': 'http://localhost:9877/static/'
      },
      browserify: {
        debug: !!process.env.DEBUG,
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
      // Karma's dev server exposes an unauthenticated route for OIDC token minting
      // (createMintVendorTokenMiddleware, below); binding it to loopback-only keeps
      // that route unreachable from outside this machine/container.
      listenAddress: '127.0.0.1',
      hostname: 'localhost',
      colors: true,
      autoWatch: true,
      browsers,
      singleRun: !process.env.DEBUG,
      concurrency: 1,
      browserNoActivityTimeout,
      captureTimeout: 60000,
      browserDisconnectTolerance: 2,
      browserDisconnectTimeout: 60000,
      customLaunchers: {
        ChromeInDocker: {
          base: 'ChromeHeadless',
          flags: [
            '--no-sandbox',
            '--autoplay-policy=no-user-gesture-required',
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream'
          ]
        },
        ChromeWebRTC: {
          base: 'Chrome',
          flags: [
            '--autoplay-policy=no-user-gesture-required',
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream'
          ]
        },
        EdgeWebRTC: {
          base: 'Edge',
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
        FirefoxInDocker: {
          base: 'Firefox',
          flags: [
            '-headless',
          ],
          prefs: {
            'media.gstreamer.enabled': false,
            'media.navigator.permission.disabled': true,
            'media.navigator.streams.fake': true,
            'media.autoplay.block-webaudio': false,
            'media.autoplay.enabled.user-gestures-needed': false,
            'media.block-autoplay-until-in-foreground': false,
            'media.getusermedia.insecure.enabled': true,
            'media.devices.insecure.enabled': true
          }
        },
        FirefoxWebRTC: {
          base: 'Firefox',
          prefs: {
            'media.gstreamer.enabled': false,
            'media.navigator.permission.disabled': true,
            'media.navigator.streams.fake': true,
            'media.autoplay.block-webaudio': false,
            'media.autoplay.enabled.user-gestures-needed': false,
            'media.block-autoplay-until-in-foreground': false,
            'media.getusermedia.insecure.enabled': true,
            'media.devices.insecure.enabled': true
          }
        }
      }
    });
  };
}

module.exports = makeConf;
