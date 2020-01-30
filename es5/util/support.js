/* globals RTCPeerConnection, webkitRTCPeerConnection, mozRTCPeerConnection, chrome, navigator */
'use strict';

var _require = require('@twilio/webrtc/lib/util'),
    guessBrowser = _require.guessBrowser;

/**
 * Check whether PeerConnection API is supported.
 * @returns {boolean}
 */


function isRTCPeerConnectionSupported() {
  return typeof RTCPeerConnection !== 'undefined' || typeof webkitRTCPeerConnection !== 'undefined' || typeof mozRTCPeerConnection !== 'undefined';
}

/**
 * Check whether GetUserMedia API is supported.
 * @returns {boolean}
 */
function isGetUserMediaSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) || !!navigator.getUserMedia || !!navigator.webkitGetUserMedia || !!navigator.mozGetUserMedia;
}

/**
 * Check whether the current browser is non-Chromium Edge.
 * @param {string} browser
 * @returns {boolean}
 */
function isNonChromiumEdge(browser) {
  return browser === 'chrome' && /Edge/.test(navigator.userAgent) && (typeof chrome === 'undefined' || typeof chrome.runtime === 'undefined');
}

/**
 * Check if the current environment is supported by the SDK.
 * @returns {boolean}
 */
function isSupported() {
  var browser = guessBrowser();
  return !!browser && !isNonChromiumEdge(browser) && isGetUserMediaSupported() && isRTCPeerConnectionSupported();
}

module.exports = isSupported;