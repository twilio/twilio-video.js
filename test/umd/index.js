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
  this.timeout(30000);

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
        page.on('console', async msg => {
          const res = msg.args()[0] ? await msg.args()[0].jsonValue() : { reason: 'Unknown' };
          if (res.status === 'success') {
            if (res.version === version) {
              return done();
            }
            return done(new Error(`Version mismatch. res.version=${res.version}, package version=${version}`));
          }
          return done(new Error(res.reason));
        });
        page.goto(`file:${join(__dirname, 'require-browser', `${filename}.html`)}`);
      });
    });

    afterEach(async () => {
      await page.close();
      await browser.close();
    });
  });
});

