'use strict';

const { guessBrowser, support: isWebRTCSupported } = require('../webrtc/util');
const { isAndroid, isAndroidWebView, isMobile, isNonChromiumEdge, rebrandedChromeBrowser, mobileWebKitBrowser } = require('./browserdetection');

const SUPPORTED_CHROME_BASED_BROWSERS = [
  'crios',
  'edg',
  'edge',
  'electron',
  'headlesschrome',
  'samsungbrowser'
];
const SUPPORTED_ANDROID_BROWSERS = [
  'chrome',
  'firefox'
];
const SUPPORTED_IOS_BROWSERS = [
  'chrome',
  'safari'
];

const SUPPORTED_MOBILE_WEBKIT_BASED_BROWSERS = ['edg'];

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

  // Android System WebView is supported even when the app appends its own token
  // to the user agent, which would otherwise look like a rebranded Chrome browser.
  if (browser === 'chrome' && isAndroidWebView()) {
    return isWebRTCSupported();
  }

  const rebrandedChrome = rebrandedChromeBrowser(browser);
  const mobileWebKit = mobileWebKitBrowser(browser);
  const supportedMobileBrowsers = isAndroid() ? SUPPORTED_ANDROID_BROWSERS : SUPPORTED_IOS_BROWSERS;

  return isWebRTCSupported()
    && (!rebrandedChrome || SUPPORTED_CHROME_BASED_BROWSERS.includes(rebrandedChrome))
    && !isNonChromiumEdge(browser)
    && (!mobileWebKit || SUPPORTED_MOBILE_WEBKIT_BASED_BROWSERS.includes(mobileWebKit))
    && (!isMobile() || supportedMobileBrowsers.includes(browser));
}

module.exports = isSupported;
