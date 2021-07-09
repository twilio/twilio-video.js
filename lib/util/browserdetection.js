/* globals chrome, navigator */
'use strict';

const { guessBrowser } = require('@twilio/webrtc/lib/util');

/**
 * Check whether the current browser is an Android device.
 * @returns {boolean}
 */
function isAndroid() {
  return /Android/.test(navigator.userAgent);
}

/**
 * Check whether the current browser is an iOS device.
 * @returns {boolean}
 */
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Check whether the current browser is iOS Chrome.
 * @returns {boolean}
 */
function isChromeIOS() {
  return guessBrowser() === 'chrome' && isMobile() && isIOS();
}

/**
 * Check whether the current browser is a mobile browser
 * @returns {boolean}
 */
function isMobile() {
  return /Mobi/.test(navigator.userAgent);
}

/**
 * Check whether the current browser is non-Chromium Edge.
 * @param {string} browser
 * @returns {boolean}
 */
function isNonChromiumEdge(browser) {
  return browser === 'chrome' && /Edge/.test(navigator.userAgent) && (
    typeof chrome === 'undefined' || typeof chrome.runtime === 'undefined'
  );
}

module.exports = {
  isAndroid,
  isIOS,
  isChromeIOS,
  isMobile,
  isNonChromiumEdge
};
