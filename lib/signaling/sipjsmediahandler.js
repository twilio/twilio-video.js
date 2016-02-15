'use strict';

var C = require('../util/constants');
var ConversationInfo = require('./conversation-info');
var QueueingEventEmitter = require('../queueingeventemitter');
var inherits = require('util').inherits;
var multipart = require('../util/multipart');
var SIP = require('sip.js');
var util = require('../util');

function SIPJSMediaHandler(session, options) {
  if (!(this instanceof SIPJSMediaHandler)) {
    return new SIPJSMediaHandler(session, options);
  }
  options = options || {};

  QueueingEventEmitter.call(this);

  var iceGatheringTimer = null;
  var localMedia = null;
  var peerConnection;
  var ready = true;
  var confId = null;
  var fromId = null;

  // NOTE(mroberts): SIP.js currently relies on PeerConnection signalingState
  // to detect whether it has a local or remote offer. A more robust solution
  // may be to track this ourselves. See
  //
  //   * https://code.google.com/p/webrtc/issues/detail?id=4996
  //   * https://code.google.com/p/webrtc/issues/detail?id=5018
  //
  var signalingState = 'stable';

  Object.defineProperties(this, {
    _iceGathering: {
      value: util.defer()
    },
    _iceGatheringTimer: {
      get: function() {
        return iceGatheringTimer;
      },
      set: function(_iceGatheringTimer) {
        iceGatheringTimer = _iceGatheringTimer;
      }
    },
    _ready: {
      get: function() {
        return ready;
      },
      set: function(_ready) {
        ready = _ready;
      }
    },
    _signalingState: {
      get: function() {
        return signalingState;
      },
      set: function(_signalingState) {
        signalingState = _signalingState;
      }
    },
    localMedia: {
      enumerable: true,
      get: function() {
        return localMedia;
      },
      set: function(_localMedia) {
        localMedia = _localMedia;
      }
    },
    confId: {
      get: function() {
        return confId;
      },
      set: function(_confId) {
        confId = _confId;
      }
    },
    fromId: {
      get: function() {
        return fromId;
      },
      set: function(_fromId) {
        fromId = _fromId;
      }
    },
    peerConnection: {
      enumerable: true,
      get: function() {
        return peerConnection;
      }
    }
  });
  peerConnection = this._createPeerConnection(session, options);
}

inherits(SIPJSMediaHandler, QueueingEventEmitter);

SIPJSMediaHandler.defaultFactory = function defaultFactory(session, options) {
  return new SIPJSMediaHandler(session, options);
};

SIPJSMediaHandler.defaultFactory.isSupported = function isSupported() {
  return SIP.WebRTC.isSupported();
};

SIPJSMediaHandler.prototype._createPeerConnection = function _createPeerConnection(session, options) {
  var self = this;

  var config = session.ua.configuration || {};
  var stunServers = options.stunServers || config.stunServers || [];
  var turnServers = options.turnServers || config.turnServers || [];
  var servers = [];

  var request = session.request;

  if (request) {
    this.confId = util.parseConversationSIDFromContactHeader(request.getHeader('Contact'));
    this.fromId = request.from.uri.user;
  }


  // A note from SIP.js:
  //
  //     Change 'url' to 'urls' whenever this issue is solved:
  //     https://code.google.com/p/webrtc/issues/detail?id=2096
  //
  [].concat(stunServers).forEach(function(server) {
    servers.push({ url: server });
  });

  turnServers.forEach(function(server) {
    server.urls.forEach(function(url) {
      servers.push({
        url: url,
        username: server.username,
        credential: server.password
      });
    });
  });

  function startIceGatheringTimer() {
    if (!self._iceGatheringTimer) {
      self._iceGatheringTimer = setTimeout(function() {
        self._iceGathering.resolve(self);
      }, config.iceCheckingTimeout);
    }
  }

  this._iceGathering.promise.then(function iceGatheringCompleted(peerConnection) {
    self.emit('iceGatheringComplete', peerConnection);
    if (self._iceGatheringTimer) {
      clearTimeout(self._iceGatheringTimer);
      self._iceGatheringTimer = null;
    }
  });

  var peerConnection = new SIP.WebRTC.RTCPeerConnection({
    iceServers: servers
  });

  peerConnection.onaddstream = function onaddstream(event) {
    self.emit('addStream', event);
  };

  peerConnection.onicecandidate = function onicecandidate(event) {
    self.emit('iceCandidate', event);
    if (event.candidate) {
      startIceGatheringTimer();
    } else {
      self._iceGathering.resolve(this);
    }
  };

  peerConnection.oniceconnectionstatechange = function oniceconnectionstatechange() {
    var stateEvent;
    switch (this.iceConnectionState) {
      case 'new':
        stateEvent = 'iceConnection';
        break;
      case 'checking':
        stateEvent = 'iceConnectionChecking';
        break;
      case 'connected':
        stateEvent = 'iceConnectionConnected';
        break;
      case 'completed':
        stateEvent = 'iceConnectionCompleted';
        break;
      case 'failed':
        stateEvent = 'iceConnectionFailed';
        break;
      case 'disconnected':
        stateEvent = 'iceConnectionDisconnected';
        break;
      case 'closed':
        stateEvent = 'iceConnectionClosed';
        break;
    }
    self.emit(stateEvent, this);
  };

  return peerConnection;
};

SIPJSMediaHandler.prototype.close = function close() {
  if (this.peerConnection.state !== 'closed') {
    callStats.sendFabricEvent(this.peerConnection, callStats.fabricEvent.fabricTerminated, this.confId);
    this.peerConnection.close();
  }
};

SIPJSMediaHandler.prototype.hold = function hold() {
  // NOTE(mroberts): We don't use SIP.js's hold functionality.
};

SIPJSMediaHandler.prototype.unhold = function unhold() {
  // NOTE(mroberts): We don't use SIP.js's hold functionality.
};

SIPJSMediaHandler.prototype.getDescription = function getDescription(options) {
  var self = this;

  if (!this.localMedia && options.stream) {
    this.peerConnection.addStream(options.stream);
    this.localMedia = options.stream;
  }

  this._ready = false;
  var csioWebRTCFunction;

  return new Promise(function createOfferOrAnswer(resolve, reject) {
    callStats.addNewFabric(self.peerConnection, self.fromId, callStats.fabricUsage.multiplex, self.confId);
    /* global callStats */
    if (self._signalingState === 'stable') {
      csioWebRTCFunction = callStats.webRTCFunctions.createOffer;
      self.peerConnection.createOffer(resolve, reject, C.DEFAULT_OFFER_OPTIONS);
    } else {
      csioWebRTCFunction = callStats.webRTCFunctions.createAnswer;
      self.peerConnection.createAnswer(resolve, reject);
    }
  }).then(function createOfferOrAnswerSucceeded(description) {
    return new Promise(function(resolve, reject) {
      self.peerConnection.setLocalDescription(description, resolve, reject);
    });
  }).then(function setLocalDescriptionSucceeded() {
    self._signalingState = self._signalingState === 'stable'
      ? 'have-local-offer'
      : 'stable';

    // NOTE(mroberts): Wait for ICE candidates to have been gathered. In the
    // future, we will support Trickle ICE.
    return self._iceGathering.promise;
  }).then(function iceCandidatesGathered() {
    var sdp = self.peerConnection.localDescription.sdp;

    if (typeof mozRTCPeerConnection !== 'undefined') {
      sdp = copyMediaLevelMsidIntoSourceLevelAttribute(sdp);
    }

    sdp = SIP.Hacks.Chrome.needsExplicitlyInactiveSDP(sdp);
    sdp = SIP.Hacks.AllBrowsers.unmaskDtls(sdp);
    sdp = SIP.Hacks.Firefox.hasMissingCLineInSDP(sdp);

    self.emit('getDescription', {
      type: self.peerConnection.localDescription.type,
      sdp: sdp
    });

    self._ready = true;

    return {
      body: sdp,
      contentType: 'application/sdp'
    };
  }).catch(function getDescriptionFailed(error) {
    self._ready = true;
    callStats.reportError(self.peerConnection, self.confId, csioWebRTCFunction, error);
    throw new SIP.Exceptions.GetDescriptionError(error);
  });
};

SIPJSMediaHandler.prototype.getLocalStreams = function getLocalStreams() {
  return this.peerConnection.getLocalStreams();
};

SIPJSMediaHandler.prototype.isReady = function isReady() {
  return this._ready;
};

SIPJSMediaHandler.prototype.getRemoteStreams = function getRemoteStreams() {
  return this.peerConnection.getRemoteStreams();
};

SIPJSMediaHandler.prototype.hasDescription = function hasDescription(message) {
  var conversationInfo = getConversationInfo(message);
  var hasSDP = !!getSDP(message);
  if (conversationInfo && !hasSDP) {
    // NOTE(mroberts): setDescription is not going to be called, so go ahead
    // and emit the Conversation Info.
    this.queue('notification', conversationInfo);
  }
  return hasSDP;
};

SIPJSMediaHandler.prototype.isMuted = function isMuted() {
  // NOTE(mroberts): We don't use SIP.js's mute behavior.
  return {
    audio: false,
    video: false
  };
};

SIPJSMediaHandler.prototype.mute = function mute() {
  // NOTE(mroberts): We don't use SIP.js's mute behavior.
};

SIPJSMediaHandler.prototype.render = function render() {
  // Do nothing.
};

SIPJSMediaHandler.prototype.setDescription = function setDescription(message) {
  var conversationInfo = getConversationInfo(message);
  if (conversationInfo) {
    this.queue('notification', conversationInfo);
  }

  var sdp = getSDP(message);

  sdp = SIP.Hacks.Firefox.cannotHandleExtraWhitespace(sdp);
  sdp = SIP.Hacks.AllBrowsers.maskDtls(sdp);

  var description = {
    type: this._signalingState === 'stable' ? 'offer' : 'answer',
    sdp: sdp
  };
  this.emit('setDescription', description);

  var self = this;
  return new Promise(function setRemoteDescription(resolve, reject) {
    self.peerConnection.setRemoteDescription(
      new SIP.WebRTC.RTCSessionDescription(description), resolve, reject);
  }).then(function setRemoteDescriptionSucceeded() {
    self._signalingState = self._signalingState === 'stable'
      ? 'have-remote-offer'
      : 'stable';
  });
};

SIPJSMediaHandler.prototype.unmute = function unmute() {
  // NOTE(mroberts): We don't use SIP.js's mute behavior.
};

SIPJSMediaHandler.prototype.updateIceServers = function updateIceServers(servers) {
  // NOTE(mroberts): We don't support ICE restart yet.
  void servers;
};

function getConversationInfo(message) {
  var contentType = message.getHeader('Content-Type');
  var notification;
  if (!contentType) {
    return null;
  } else if (contentType === 'application/conversation-info+json') {
    notification = message.body;
  } else if (/^multipart\//.test(contentType)) {
    notification = multipart.getConversationInfo(multipart.parse(contentType, message.body));
  }
  if (notification) {
    try {
      return ConversationInfo.parseNotification(notification);
    } catch (error) {
      // Do nothing
    }
  }
  return null;
}

function getSDP(message) {
  var contentType = message.getHeader('Content-Type');
  if (!contentType) {
    return null;
  } else if (contentType === 'application/sdp') {
    return message.body;
  } else if (/^multipart\//.test(contentType)) {
    return multipart.getSDP(multipart.parse(contentType, message.body));
  }
  return null;
}

/**
 * Get the MSID out of a media level.
 * @param {string} mediaLevel
 * @returns {?Array<String>}
 */
function getMsidFromMediaLevel(mediaLevel) {
  var match = mediaLevel.match(/a=msid: *([^ ]+) +([^ ]+) *\r\n/);
  if (match) {
    return [match[1], match[2]];
  }
  return null;
}

/**
 * Firefox specifies media-level MSIDs, but Chrome expects source-level MSIDs
 * in order to populate MediaStream.id and MediaStreamTrack.id; therefore, we
 * need to copy the media-level MSIDs into source-level attributes.
 * @param {string} sdp
 * @returns {string}
 */
function copyMediaLevelMsidIntoSourceLevelAttribute(sdp) {
  var parts = sdp.split('\r\nm=');
  var sourceLevel = parts[0];
  var mediaLevels = parts.slice(1).map(function(mediaLevel) {
    mediaLevel = 'm=' + mediaLevel;

    // Get the MSID out of the media-level.
    var msid = getMsidFromMediaLevel(mediaLevel);
    if (!msid) {
      return mediaLevel.replace(/\r\n$/, '');
    }

    if (!mediaLevel.match(/\r\n$/)) {
      mediaLevel += '\r\n';
    }

    // Capture the SSRCs in order, filtering out any duplicates.
    var matches = mediaLevel.match(/a=ssrc: *[^ ]*.*\r\n/g) || [];

    mediaLevel = mediaLevel.replace(/\r\n$/, '');

    var uniqueSsrcs = {};
    /* eslint camelcase:0 */
    matches.forEach(function(a_ssrc) {
      var match = a_ssrc.match(/a=ssrc: *([^ ]*).*\r\n/);
      if (match) {
        var ssrc = match[1];
        // Add source-level MSID attributes.
        if (!uniqueSsrcs[ssrc]) {
          uniqueSsrcs[ssrc] = ssrc;
          mediaLevel += '\r\na=ssrc:' + ssrc + ' msid:' + msid.join(' ');
        }
      }
    });

    return mediaLevel;
  });
  return sourceLevel + '\r\n' + mediaLevels.join('\r\n') + '\r\n';
}

module.exports = SIPJSMediaHandler;
