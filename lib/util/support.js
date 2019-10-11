/* globals RTCPeerConnection, webkitRTCPeerConnection, mozRTCPeerConnection, navigator */
'use strict';

const { guessBrowser } = require('@twilio/webrtc/lib/util');

/**
 * Check whether PeerConnection API is supported.
 * @returns {boolean}
 */
function isRTCPeerConnectionSupported() {
  return typeof RTCPeerConnection !== 'undefined'
    || typeof webkitRTCPeerConnection !== 'undefined'
    || typeof mozRTCPeerConnection !== 'undefined';
}

/**
 * Check whether GetUserMedia API is supported.
 * @returns {boolean}
 */
function isGetUserMediaSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    || !!(navigator.getUserMedia)
    || !!(navigator.webkitGetUserMedia)
    || !!(navigator.mozGetUserMedia);
}

/**
 * @returns {boolean} - true if the browser is explicitly unsupported.
 *  Note: this function returning false does not mean that browser is supported.
 */
function isExplicitlyUnsupportedBrowser() {
  if (typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string') {
    return /Edg(e)?/.test(navigator.userAgent);
  }
  return false;
}

/**
 * Check if the current environment is supported by the SDK.
 * @returns {boolean}
 */
function isSupported() {
  return !isExplicitlyUnsupportedBrowser()
    && !!guessBrowser()
    && isGetUserMediaSupported()
    && isRTCPeerConnectionSupported();
}

module.exports = isSupported;
