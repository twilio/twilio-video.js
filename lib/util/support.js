'use strict';

const { guessBrowser, support: isWebRTCSupported } = require('../webrtc/util');
const { getSdpFormat } = require('../webrtc/util/sdp');
const { isAndroid, isMobile, isNonChromiumEdge, rebrandedChromeBrowser, mobileWebKitBrowser } = require('./browserdetection');

const SUPPORTED_CHROME_BASED_BROWSERS = [
  'crios',
  'edg',
  'edge',
  'electron',
  'headlesschrome'
];
const SUPPORTED_ANDROID_BROWSERS = [
  'chrome',
  'firefox'
];
const SUPPORTED_IOS_BROWSERS = [
  'chrome',
  'safari'
];
// Currently none. Add 'brave', 'edg', and 'edge' here once we start supporting them
const SUPPORTED_MOBILE_WEBKIT_BASED_BROWSERS = [];

/**
 * Check if the current browser is officially supported by twilio-video.js.
 * @returns {boolean}
 */
function isSupported() {
  const browser = guessBrowser();

  // NOTE (csantos): Return right away if there is no browser detected
  // to prevent unnecessary checks which could lead to errors
  if (!browser) {
    return false;
  }

  const rebrandedChrome = rebrandedChromeBrowser(browser);
  const mobileWebKit = mobileWebKitBrowser(browser);
  const supportedMobileBrowsers = isAndroid() ?
    SUPPORTED_ANDROID_BROWSERS : SUPPORTED_IOS_BROWSERS;

  return !!browser
    && isWebRTCSupported()
    && getSdpFormat() === 'unified'
    && (!rebrandedChrome || SUPPORTED_CHROME_BASED_BROWSERS.includes(rebrandedChrome))
    && !isNonChromiumEdge(browser)
    && (!mobileWebKit || SUPPORTED_MOBILE_WEBKIT_BASED_BROWSERS.includes(mobileWebKit))
    && (!isMobile() || supportedMobileBrowsers.includes(browser));
}

module.exports = isSupported;
