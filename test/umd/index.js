'use strict';

const { join } = require('path');
const puppeteer = require('puppeteer');
const version = require('../../package.json').version;

const publicVars = [
  'connect',
  'createLocalAudioTrack',
  'createLocalTracks',
  'createLocalVideoTrack',
  'isSupported',
  'LocalAudioTrack',
  'LocalDataTrack',
  'LocalVideoTrack',
  'Logger'
];

describe('UMD', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(5000);

  describe('RequireJS (browser)', () => {
    let browser;
    let page;

    beforeEach(async () => {
      browser = await puppeteer.launch({ headless: true });
      page = await browser.newPage();
    });

    [
      ['unminified', 'index'],
      ['minified', 'min']
    ].forEach(([mode, filename]) => {
      it(`should receive a video object with ${publicVars.join(', ')} properties (${mode})`, done => {
        const onConsole = async msg => {
          const handle = msg.args()[0];
          if (!handle) {
            return;
          }
          let res;
          try {
            res = await handle.jsonValue();
          } catch {
            return;
          }
          if (!res || !res.status) {
            return;
          }
          page.off('console', onConsole);
          if (res.status !== 'success') {
            done(new Error(res.reason));
          } else if (res.version !== version) {
            done(new Error(`Version mismatch. res.version=${res.version}, package version=${version}`));
          } else {
            done();
          }
        };
        page.on('console', onConsole);
        page.goto(`file:${join(__dirname, 'require-browser', `${filename}.html`)}`);
      });
    });

    afterEach(async () => {
      await page.close();
      await browser.close();
    });
  });
});

