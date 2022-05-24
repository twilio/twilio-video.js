'use strict';

const assert = require('assert');
const { isIOSChrome } = require('../../../../lib/webrtc/util');
const { isIpad } = require('../../../../lib/util/browserdetection');

// eslint-disable-next-line no-warning-comments
// TODO(joma): Move the contents of this file to twilio-webrtc.js.
describe('Browser Detection', () => {
  describe('isIOSChrome', () => {
    let oldAgent;
    beforeEach(() => {
      oldAgent = navigator.userAgent;
    });

    afterEach(() => {
      navigator.userAgent = oldAgent;
      if (global.chrome) {
        delete global.chrome;
      }
      if (navigator.brave) {
        delete navigator.brave;
      }
    });

    [
      [
        'Chrome on iPod',
        'Mozilla/5.0 (iPod; CPU iPhone OS 8_4 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) CriOS/44.0.2403.67 Mobile/12H143 Safari/600.1.4',
        {}
      ],
      [
        'Chrome on iPhone',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/90.0.4430.216 Mobile/15E148 Safari/604.1',
        {}
      ],
      [
        'Chrome on iPad',
        'Mozilla/5.0 (iPad; CPU OS 14_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/91.0.4472.80 Mobile/15E148 Safari/604.1',
        {}
      ]
    ].forEach(([browser, useragent, chrome]) => {
      it('returns true for: ' + browser, () => {
        navigator.userAgent = useragent;
        if (chrome) {
          global.chrome = chrome;
        }
        assert.equal(isIOSChrome(), true);
      });
    });

    [
      [
        'Brave on iPhone',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.2 Mobile/15E148 Safari/604.1',
        null,
        {}
      ],
      [
        'Moto G7 Android Chrome',
        'Mozilla/5.0 (Linux; Android 9; moto g(7) power) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.96 Mobile Safari/537.36'
      ],
      [
        'Chrome on Windows',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36',
        { runtime: {} }
      ],
      [
        'Edge (Chromium) on Windows',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox One) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36 Edg/15.15063',
        { runtime: {} }
      ],
      [
        'Edge on iPhone',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 EdgiOS/46.3.13 Mobile/15E148 Safari/605.1.15'
      ],
      [
        'Edge on Android',
        'Mozilla/5.0 (Linux; Android 10; HD1913) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Mobile Safari/537.36 EdgA/46.3.4.5155'
      ],
      [
        'Firefox on Android',
        'Mozilla/5.0 (Android 7.0; Mobile; rv:54.0) Gecko/54.0 Firefox/54.0'
      ],
      [
        'Firefox on iPhone',
        'Mozilla/5.0 (iPhone; CPU OS 14_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/33.1 Mobile/15E148 Safari/605.1.15'
      ],
      [
        'Firefox on Windows',
        'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:54.0) Gecko/20100101 Firefox/69.0'
      ],
      [
        'Safari on Mac',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13 Safari/605.1.15'
      ],

    ].forEach(([browser, useragent, chrome, brave]) => {
      it('returns false for: ' + browser, () => {
        navigator.userAgent = useragent;
        if (chrome) {
          global.chrome = chrome;
        }
        if (brave) {
          navigator.brave = brave;
        }
        assert.equal(isIOSChrome(), false);
      });
    });
  });

  describe('isIpad', () => {
    [
      [
        'Safari on iPad: Desktop Mode',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15',
        5,
        true,
        { width: 1536 }
      ],
      [
        'Safari on iPad: Tablet Mode',
        'Mozilla/5.0 (iPad; CPU OS 15_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Mobile/15E148 Safari/604.1',
        5,
        true,
        { width: 1536 }
      ],
      [
        'Mac Desktop on Safari',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15',
        0,
        false,
        { width: 3840 }
      ],
      [
        'Safari on iPhone: Mobile Mode',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.5 Mobile/15E148 Safari/604.1',
        5,
        false,
        { width: 375 }
      ],
      [
        'Safari on iPhone: Desktop Mode',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.5 Safari/605.1.15',
        5,
        false,
        { width: 375 }
      ],
    ].forEach(([testCase, useragent, maxTouchPoints, expectedBool, screenWidth]) => {
      it(`returns ${expectedBool} for ${testCase} `, () => {
        navigator.userAgent = useragent;
        navigator.maxTouchPoints = maxTouchPoints;
        window.screen = screenWidth;
        assert.equal(isIpad(), expectedBool);
      });
    });
  });
});
