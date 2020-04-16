'use strict';

const assert = require('assert');
const isSupported = require('../../../../lib/util/support');

describe('isSupported', () => {
  let oldAgent;
  before(() => {
    oldAgent = navigator.userAgent;
  });

  after(() => {
    navigator.userAgent = oldAgent;
  });

  [
    [
      'Chrome on Windows',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36',
      { runtime: {} }
    ],
    [
      'Chrome on Mac',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36',
      { runtime: {} }
    ],
    [
      'Headless Chrome',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/81.0.4044.0 Safari/537.36',
      { runtime: {} }
    ],
    [
      'Safari on Mac',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13 Safari/605.1.15'
    ],
    [
      'Safari on iPad',
      'Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13 Mobile/15E148 Safari/604.1'
    ],
    [
      'Safari on iPhone',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13 Mobile/15E148 Safari/604.1'
    ],
    [
      'Firefox on Windows',
      'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:54.0) Gecko/20100101 Firefox/69.0'
    ],
    [
      'Firefox on Mac',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:61.0) Gecko/20100101 Firefox/69.0'
    ],
    [
      'Firefox on Linux',
      'Mozilla/5.0 (X11; Linux i586; rv:31.0) Gecko/20100101 Firefox/69.0'
    ],
    [
      'Edge (Chromium)',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox One) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36 Edg/15.15063',
      { runtime: {} }
    ],
    [
      'Electron',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Electron/3.1.12 Safari/537.36'
    ]
  ].forEach(([browser, useragent, chrome]) => {
    it('returns true for supported browser: ' + browser, () => {
      navigator.userAgent = useragent;
      if (chrome) {
        global.chrome = chrome;
      }
      assert.equal(isSupported(), true);
    });
  });

  [
    [
      'Edge 42',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox One) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36 Edge/15.15063',
      {}
    ],
    [
      'Edge 25',
      'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2486.0 Safari/537.36 Edge/13.10586',
      {}
    ],
    [
      'Another Edge',
      'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36 Edge/12.0',
      {}
    ],
    [
      'Brave',
      'Mozilla/5.0 (Linux; Android 9; ONEPLUS A6013) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.157 Mobile Safari/537.36 Brave/74'
    ],
    [
      'Another Brave',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Brave Chrome/78.0.3904.108 Safari/537.36'
    ],
    [
      'Opera',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36 OPR/56.0.3051.52'
    ],
    [
      'Samsung Browser',
      'Mozilla/5.0 (Linux; Android 9; SAMSUNG SM-G950U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/10.2 Chrome/71.0.3578.99 Mobile Safari/537.36'
    ]
  ].forEach(([browser, useragent, chrome]) => {
    it('returns false for unsupported browser: ' + browser, () => {
      navigator.userAgent = useragent;
      global.chrome = chrome;
      assert.equal(isSupported(), false);
    });
  });
});
