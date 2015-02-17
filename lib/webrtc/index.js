'use strict';

var util = require('../util');

var detectedPlatform = null;
var detectedVersion = null;

var createIceServer = null;
var createIceServers = null;
var getStatistics = require('./getstatistics');
var getUserMedia = null;
var MediaStream = null;
var RTCIceCandidate = null;
var RTCPeerConnection = null;
var RTCSessionDescription = null;

if (typeof navigator === 'undefined') {

  detectedPlatform = 'Node';
  detectedVersion = -1;

  var wrtc = util.requireNoBrowserify('wrtc');
  getUserMedia = wrtc.getUserMedia;
  MediaStream = wrtc.MediaStream;
  RTCIceCandidate = wrtc.RTCIceCandidate;
  RTCPeerConnection = wrtc.RTCPeerConnection;
  RTCSessionDescription = wrtc.RTCSessionDescription;

  createIceServer = function createIceServer(url, username, password) {
    var iceServer = null;
    var urlParts = url.split(':');
    if (urlParts[0].indexOf('stun') === 0) {
      // Create iceServer with stun url.
      iceServer = {
        url: url
      };
    } else if (urlParts[0].indexOf('turn') === 0) {
      // Chrome M28 & above uses below TURN format.
      iceServer = {
        url: url,
        credential: password,
        username: username
      };
    }
    return iceServer;
  };

  createIceServers = function createIceServers(urls, username, password) {
    var iceServers = [];
    for (var i = 0; i < urls.length; i++) {
      var iceServer = createIceServer(urls[i], username, password);
      if (iceServer !== null) {
        iceServers.push(iceServer);
      }
    }
    return iceServers;
  };

} else if (typeof window !== 'undefined' && navigator.mozGetUserMedia) {

  detectedPlatform = 'Firefox';
  detectedVersion =
    parseInt(navigator.userAgent.match(/Firefox\/([0-9]+)\./)[1], 10);

  createIceServer = function createIceServer(url, username, password) {
    var iceServer = null;
    var urlParts = url.split(':');
    if (urlParts[0].indexOf('stun') === 0) {
      // Create ICE server with STUN URL.
      iceServer = {
        'url': url
      };
    } else if (urlParts[0].indexOf('turn') === 0) {
      if (detectedVersion < 27) {
        // Create iceServer with turn url.
        // Ignore the transport parameter from TURN url for FF version <=27.
        var turnUrlParts = url.split('?');
        // Return null for createIceServer if transport=tcp.
        if (turnUrlParts.length === 1 ||
          turnUrlParts[1].indexOf('transport=udp') === 0) {
          iceServer = {
            url: turnUrlParts[0],
            credential: password,
            username: username
          };
        }
      } else {
        // FF 27 and above supports transport parameters in TURN url,
        // So passing in the full url to create iceServer.
        iceServer = {
          url: url,
          credential: password,
          username: username
        };
      }
    }
    return iceServer;
  };

  createIceServers = function createIceServers(urls, username, password) {
    var iceServers = [];
    // Use .url for FireFox.
    for (var i = 0; i < urls.length; i++) {
      var iceServer = createIceServer(urls[i], username, password);
      if (iceServer !== null) {
        iceServers.push(iceServer);
      }
    }
    return iceServers;
  };

  getUserMedia = navigator.mozGetUserMedia.bind(navigator);

  MediaStream = window.MediaStream;

  RTCIceCandidate = window.mozRTCIceCandidate;

  RTCPeerConnection = function RTCPeerConnection(pcConfig, pcConstraints) {
    // .urls is not supported in FF yet.
    maybeFixConfiguration(pcConfig);
    return new window.mozRTCPeerConnection(pcConfig, pcConstraints);
  };

  RTCSessionDescription = window.mozRTCSessionDescription;

} else if (typeof window !== 'undefined' && navigator.webkitGetUserMedia) {

  detectedPlatform = 'Chrome';
  // Temporary fix until crbug/374263 is fixed.
  // Setting Chrome version to 999, if version is unavailable.
  var result = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);
  detectedVersion = result !== null ? parseInt(result[2], 10) : 999;

  createIceServer = function createIceServer(url, username, password) {
    var iceServer = null;
    var urlParts = url.split(':');
    if (urlParts[0].indexOf('stun') === 0) {
      // Create iceServer with stun url.
      iceServer = {
        url: url
      };
    } else if (urlParts[0].indexOf('turn') === 0) {
      // Chrome M28 & above uses below TURN format.
      iceServer = {
        url: url,
        credential: password,
        username: username
      };
    }
    return iceServer;
  };

  createIceServers = function createIceServers(urls, username, password) {
    var iceServers = [];
    if (detectedVersion >= 34) {
      // .urls is supported since Chrome M34.
      iceServers = {
        urls: urls,
        credential: password,
        username: username
      };
    } else {
      for (var i = 0; i < urls.length; i++) {
        var iceServer = createIceServer(urls[i], username, password);
        if (iceServer !== null) {
          iceServers.push(iceServer);
        }
      }
    }
    return iceServers;
  };

  getUserMedia = navigator.webkitGetUserMedia.bind(navigator);

  MediaStream = window.webkitMediaStream;
  RTCIceCandidate = window.RTCIceCandidate;
  RTCSessionDescription = window.RTCSessionDescription;

  RTCPeerConnection = function RTCPeerConnection(pcConfig, pcConstraints) {
    // .urls is supported since Chrome M34.
    if (detectedVersion < 34) {
      maybeFixConfiguration(pcConfig);
    }
    return new window.webkitRTCPeerConnection(pcConfig, pcConstraints);
  };

}

module.exports.detectedPlatform = detectedPlatform;
module.exports.detectedVersion = detectedVersion;
module.exports.createIceServer = createIceServer;
module.exports.createIceServers = createIceServers;
module.exports.getStatistics = getStatistics;
module.exports.getUserMedia = getUserMedia;
module.exports.MediaStream = MediaStream;
module.exports.RTCIceCandidate = RTCIceCandidate;
module.exports.RTCPeerConnection = RTCPeerConnection;
module.exports.RTCSessionDescription = RTCSessionDescription;
