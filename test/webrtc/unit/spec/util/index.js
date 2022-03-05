'use strict';

var assert = require('assert');
var util = require('../../../../lib/util');

describe('Util', () => {
  describe('guessBrowser', () => {
    [
      [
        'Chrome Desktop',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36',
        'chrome'
      ],
      [
        'Chrome iOS',
        'Mozilla/5.0 (iPad; CPU OS 13_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/79.0.3945.73 Mobile/15E148 Safari/604.1',
        'chrome'
      ],
      [
        'Firefox Desktop',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:61.0) Gecko/20100101 Firefox/69.0',
        'firefox'
      ],
      [
        'Firefox iOS',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/22.0 Safari/605.1.15',
        'firefox'
      ],
      [
        'Safari Desktop',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.4 Safari/605.1.15',
        'safari'
      ],
      [
        'Safari WKWebView - iPhone',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)',
        'safari'
      ],
      [
        'Safari WKWebView - iPad',
        'Mozilla/5.0 (iPad; CPU OS 14_4 like Mac OS X) AppleWebkit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
        'safari'
      ],
      [
        'Safari iOS - Instagram',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 220.0.0.8.117 (iPhone12,3; iOS 15_3; en_US; en; scale=3.00; 1125x2436; 347566818) NW/3',
        'safari'
      ],
      [
        'Safari iOS - Snapchat',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.3 Mobile/15E148 Snapchat/11.64.0.38 (like Safari/8612.4.9.0.3, panda)',
        'safari'
      ],
      [
        'Safari iOS - Slack ',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.3 Mobile/15E148 Safari/604.1',
        'safari'
      ],
      [
        'Edge Desktop (Chromium)',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox One) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36 Edg/15.15063',
        'chrome'
      ]
    ].forEach(([browser, userAgent, name]) => {
      context(`${browser} - ${userAgent}`, () => {
        it(`should return "${name}"`, () => {
          assert.equal(util.guessBrowser(userAgent), name);
        });
      });
    });
  });

  describe('guessBrowserVersion', () => {
    [
      [
        'Chrome Desktop',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36',
        { major: 77, minor: 0 }
      ],
      [
        'Chrome iOS',
        'Mozilla/5.0 (iPad; CPU OS 13_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/79.0.3945.73 Mobile/15E148 Safari/604.1',
        { major: 79, minor: 0 }
      ],
      [
        'Firefox Desktop',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:61.0) Gecko/20100101 Firefox/69.0',
        { major: 69, minor: 0 }
      ],
      [
        'Firefox iOS',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/22.0 Safari/605.1.15',
        { major: 22, minor: 0 }
      ],
      [
        'Safari Desktop',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.4 Safari/605.1.15',
        { major: 13, minor: 0 }
      ],
      [
        'Edge Desktop (Chromium)',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox One) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36 Edg/15.15063',
        { major: 52, minor: 0 }
      ]
    ].forEach(([browser, userAgent, version]) => {
      context(`${browser} - ${userAgent}`, () => {
        it(`should return ${JSON.stringify(version)}`, () => {
          assert.deepEqual(util.guessBrowserVersion(userAgent), version);
        });
      });
    });
  });
});
