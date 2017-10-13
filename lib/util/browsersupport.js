/* globals RTCPeerConnection, webkitRTCPeerConnection, mozRTCPeerConnection, navigator */
'use strict';

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
 * Check if the browser is supported by the SDK.
 * @returns {boolean}
 */
function isBrowserSupported() {
  return isGetUserMediaSupported() && isRTCPeerConnectionSupported();
}

module.exports = isBrowserSupported;
