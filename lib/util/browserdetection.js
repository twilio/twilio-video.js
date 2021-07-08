/* globals chrome, navigator */
'use strict';

const { guessBrowser } = require('@twilio/webrtc/lib/util');

function isAndroid() {
  return /Android/.test(navigator.userAgent);
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isChromeIOS() {
  return guessBrowser() === 'chrome' && isMobile() && isIOS();
}

/**
 * Check whether the current browser is a mobile browser
 * @param {string} userAgent
 * @returns {boolean}
 */
function isMobile(userAgent) {
  userAgent = userAgent || navigator.userAgent;
  return /Mobi/.test(userAgent);
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
