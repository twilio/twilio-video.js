'use strict';

const assert = require('assert');
const isSupported = require('../../../../lib/util/support');
const { clearChromeCachedSdpFormat } = require('../../../../lib/webrtc/util/sdp');

describe('isSupported', () => {
  let oldAgent;
  beforeEach(() => {
    oldAgent = navigator.userAgent;
  });

  afterEach(() => {
    clearChromeCachedSdpFormat();
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
      'Moto G7 Android Chrome',
      'Mozilla/5.0 (Linux; Android 9; moto g(7) power) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.96 Mobile Safari/537.36'
    ],
    [
      'Chrome on Mac',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36',
      { runtime: {} }
    ],
    [
      'Chrome on Windows',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36',
      { runtime: {} }
    ],
    [
      'Headless Chrome',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/81.0.4044.0 Safari/537.36',
      { runtime: {} }
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
    ],
    [
      'Electron',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Electron/3.1.12 Safari/537.36'
    ],
    [
      'Firefox on Android',
      'Mozilla/5.0 (Android 7.0; Mobile; rv:54.0) Gecko/54.0 Firefox/54.0'
    ],
    [
      'Firefox on Linux',
      'Mozilla/5.0 (X11; Linux i586; rv:31.0) Gecko/20100101 Firefox/69.0'
    ],
    [
      'Firefox on Mac',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:61.0) Gecko/20100101 Firefox/69.0'
    ],
    [
      'Firefox on Windows',
      'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:54.0) Gecko/20100101 Firefox/69.0'
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
      'Safari on Mac',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13 Safari/605.1.15'
    ],
    [
      'Safari WKWebView - iPhone',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)',
    ],
    [
      'Safari WKWebView - iPad',
      'Mozilla/5.0 (iPad; CPU OS 15_3 like Mac OS X) AppleWebkit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
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
      'Edge (Chromium) on Mac',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36 Edg/90.0.818.66',
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
      'Firefox on iPhone',
      'Mozilla/5.0 (iPhone; CPU OS 14_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/33.1 Mobile/15E148 Safari/605.1.15'
    ],
    [
      'Edge on Android',
      'Mozilla/5.0 (Linux; Android 10; HD1913) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Mobile Safari/537.36 EdgA/46.3.4.5155'
    ],
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
      'Another Brave on Mac',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
      null,
      {}
    ],
    [
      'Brave on iPhone',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.2 Mobile/15E148 Safari/604.1',
      null,
      {}
    ],
    [
      'Latest Desktop Brave',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.113 Safari/537.36',
      null,
      {}
    ],
    [
      'Chrome on iPhone OS version 10.3',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) CriOS/56.0.2924.75 Mobile/14E5239e Safari/602.1',
      null,
      {}
    ],
    [
      'Chrome on iPad OS version 12.0',
      'Mozilla/5.0 (iPad; CPU OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/71.0.3578.77 Mobile/15E148 Safari/605.1',
      null,
      {}
    ],
    [
      'Opera',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36 OPR/56.0.3051.52'
    ],
    [
      'Samsung Browser',
      'Mozilla/5.0 (Linux; Android 9; SAMSUNG SM-G950U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/10.2 Chrome/71.0.3578.99 Mobile Safari/537.36'
    ]
  ].forEach(([browser, useragent, chrome, brave]) => {
    it('returns false for unsupported browser: ' + browser, () => {
      navigator.userAgent = useragent;
      if (chrome) {
        global.chrome = chrome;
      }
      if (brave) {
        navigator.brave = brave;
      }
      assert.equal(isSupported(), false);
    });
  });

  describe('return false when sdp format is plan-b', () => {
    describe('and browser is chrome', () => {
      let oldRTCPeerConnection;
      let oldRTCPeerConnectionPrototype;
      let oldUserAgent;

      beforeEach(() => {
        oldUserAgent = navigator.userAgent;
        navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36';
        oldRTCPeerConnection = global.RTCPeerConnection;
        oldRTCPeerConnectionPrototype = oldRTCPeerConnection.prototype;
      });

      afterEach(() => {
        navigator.userAgent = oldUserAgent;
        global.RTCPeerConnection = oldRTCPeerConnection;
        global.RTCPeerConnection.prototype = oldRTCPeerConnectionPrototype;
      });

      it('and RTCPeerConnection.prototype.addTransceiver is not supported', () => {
        global.RTCPeerConnection.prototype = Object.assign({}, oldRTCPeerConnectionPrototype);
        delete global.RTCPeerConnection.prototype.addTransceiver;
        assert.equal(isSupported(), false);
      });

      it('and RTCPeerConnection.prototype.addTransceiver throws an exception', () => {
        global.RTCPeerConnection = function() {
          this.addTransceiver = function() {
            throw new Error();
          };
          this.close = function() {};
        };
        global.RTCPeerConnection.prototype.addTransceiver = function() {};
        assert.equal(isSupported(), false);
      });
    });

    describe('and browser is safari', () => {
      let oldUserAgent;
      let oldRTCRtpTransceiver;

      beforeEach(() => {
        oldUserAgent = navigator.userAgent;
        navigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13 Safari/605.1.15';
        oldRTCRtpTransceiver = global.RTCRtpTransceiver;
      });

      afterEach(() => {
        navigator.userAgent = oldUserAgent;
        global.RTCRtpTransceiver = oldRTCRtpTransceiver;
      });

      it('and RTCRtpTransceiver is not supported', () => {
        delete global.RTCRtpTransceiver;
        assert.equal(isSupported(), false);
      });

      it('and RTCRtpTransceiver is supported but currentDirection is missing', () => {
        delete global.RTCRtpTransceiver.prototype.currentDirection;
        assert.equal(isSupported(), false);
      });
    });
  });
});
