'use strict';

const assert = require('assert');
const { isChromeIOS } = require('../../../../lib/util/support');

describe.only('isChromeIOS', () => {
  let oldAgent;
  before(() => {
    oldAgent = navigator.userAgent;
  });

  after(() => {
    navigator.userAgent = oldAgent;
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
      assert.equal(isChromeIOS(), true);
    });
  });

  [
    [
      'Firefox on iPhone',
      'Mozilla/5.0 (iPhone; CPU OS 14_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/33.1 Mobile/15E148 Safari/605.1.15'
    ],
    [
      'Brave on iPhone',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.2 Mobile/15E148 Safari/604.1',
      null,
      {}
    ]
  ].forEach(([browser, useragent, chrome, brave]) => {
    it('returns false for: ' + browser, () => {
      navigator.userAgent = useragent;
      if (chrome) {
        global.chrome = chrome;
      }
      if (brave) {
        navigator.brave = brave;
      }
      assert.equal(isChromeIOS(), false);
    });
  });
});
