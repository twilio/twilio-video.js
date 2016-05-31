'use strict';

var C = require('../../util/constants');
var ConversationInfo = require('../conversation-info');
var QueueingEventEmitter = require('../../queueingeventemitter');
var inherits = require('util').inherits;
var multipart = require('../../util/multipart');
var SIP = require('sip.js');
var util = require('../../util');

function SIPJSMediaHandler(session, options) {
  if (!(this instanceof SIPJSMediaHandler)) {
    return new SIPJSMediaHandler(session, options);
  }
  options = options || {};

  QueueingEventEmitter.call(this);

  var sessionConfiguration = session.ua.configuration || {};

  var iceGatheringTimer = null;
  var iceGatheringTimeout = sessionConfiguration.iceCheckingTimeout;
  var localMedia = null;
  var peerConnection = null;
  var ready = true;
  var remoteOffer = null;

  // NOTE(mroberts): SIP.js currently relies on PeerConnection signalingState
  // to detect whether it has a local or remote offer. A more robust solution
  // may be to track this ourselves. See
  //
  //   * https://code.google.com/p/webrtc/issues/detail?id=4996
  //   * https://code.google.com/p/webrtc/issues/detail?id=5018
  //
  var signalingState = 'stable';

  Object.defineProperties(this, {
    _deferredPeerConnection: {
      value: util.defer()
    },
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
    _iceGatheringTimeout: {
      value: iceGatheringTimeout
    },
    _peerConnection: {
      get: function() {
        return peerConnection;
      },
      set: function(_peerConnection) {
        peerConnection = _peerConnection;
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
    _remoteOffer: {
      get: function() {
        return remoteOffer;
      },
      set: function(_remoteOffer) {
        remoteOffer = _remoteOffer;
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
    peerConnection: {
      enumerable: true,
      get: function() {
        return peerConnection;
      }
    }
  });
}

inherits(SIPJSMediaHandler, QueueingEventEmitter);

SIPJSMediaHandler.defaultFactory = function defaultFactory(session, options) {
  return new SIPJSMediaHandler(session, options);
};

SIPJSMediaHandler.defaultFactory.isSupported = function isSupported() {
  return SIP.WebRTC.isSupported();
};

SIPJSMediaHandler.prototype.createPeerConnection = function createPeerConnection(configuration) {
  var self = this;

  function startIceGatheringTimer() {
    if (!self._iceGatheringTimer) {
      self._iceGatheringTimer = setTimeout(function() {
        self._iceGathering.resolve(self);
      }, self._iceGatheringTimeout);
    }
  }

  this._iceGathering.promise.then(function iceGatheringCompleted(peerConnection) {
    self.emit('iceGatheringComplete', peerConnection);
    if (self._iceGatheringTimer) {
      clearTimeout(self._iceGatheringTimer);
      self._iceGatheringTimer = null;
    }
  });

  // NOTE(mroberts): `iceTransportPolicy` is still set via `iceTransports` in
  // Chrome.
  if (typeof navigator === 'object' && typeof navigator.webkitGetUserMedia === 'function' && configuration.iceTransportPolicy) {
    configuration.iceTransports = configuration.iceTransportPolicy;
  }

  // NOTE(mroberts): Patch up `url` to `urls` in `iceServers`.
  if (configuration.iceServers) {
    configuration.iceServers = configuration.iceServers.map(function(iceServer) {
      var newIceServer = Object.assign({}, iceServer);
      if (newIceServer.url && !newIceServer.urls) {
        newIceServer.urls = [newIceServer.url];
        delete newIceServer.url;
      }
      return newIceServer;
    });
  }

  var peerConnection = new SIP.WebRTC.RTCPeerConnection(configuration);

  peerConnection.onaddstream = function onaddstream(event) {
    self.emit('addStream', event);
  };

  peerConnection.onicecandidate = function onicecandidate(event) {
    self.emit('iceCandidate', event);
    if (event.candidate) {
      startIceGatheringTimer();
    } else {
      self._iceGathering.resolve(self);
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

  this._deferredPeerConnection.resolve();
  this._peerConnection = peerConnection;
};

SIPJSMediaHandler.prototype.getPeerConnection = function getPeerConnection() {
  var self = this;
  return this._deferredPeerConnection.promise.then(function peerConnectionCreated() {
    return self.peerConnection;
  });
};

SIPJSMediaHandler.prototype.close = function close() {
  if (this.peerConnection && this.peerConnection.state !== 'closed') {
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

  // NOTE(mroberts): If we have not created a PeerConnection yet, get one first.
  if (!this.peerConnection) {
    return this.getPeerConnection().then(function peerConnectionCreated() {
      return self.getDescription(options);
    });
  }

  // NOTE(mroberts): If we saved a remote offer, we need to call
  // setRemoteDescription before calling getDescription.
  if (this._remoteOffer) {
    var remoteOffer = this._remoteOffer;
    this._remoteOffer = null;
    return new Promise(function setRemoteDescription(resolve, reject) {
      return self.peerConnection.setRemoteDescription(remoteOffer, resolve, reject);
    }).then(function() {
      return self.getDescription(options);
    });
  }

  if (!this.localMedia && options.stream) {
    this.peerConnection.addStream(options.stream);
    this.localMedia = options.stream;
  }

  this._ready = false;

  return new Promise(function createOfferOrAnswer(resolve, reject) {
    if (self._signalingState === 'stable') {
      self.peerConnection.createOffer(resolve, reject, C.DEFAULT_OFFER_OPTIONS);
    } else {
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

  var init = {
    type: this._signalingState === 'stable' ? 'offer' : 'answer',
    sdp: sdp
  };
  this.emit('setDescription', init);

  var self = this;
  return new Promise(function setOrSaveRemoteDescription(resolve, reject) {
    var description = new SIP.WebRTC.RTCSessionDescription(init);
    if (self.peerConnection) {
      return self.peerConnection.setRemoteDescription(description, resolve, reject);
    }
    self._remoteOffer = description;
    resolve();
  }).then(function setRemoteDescriptionSucceeded() {
    self._signalingState = self._signalingState === 'stable'
      ? 'have-remote-offer'
      : 'stable';
  });
};

SIPJSMediaHandler.prototype.unmute = function unmute() {
  // NOTE(mroberts): We don't use SIP.js's mute behavior.
};

SIPJSMediaHandler.prototype.updateIceServers = function updateIceServers() {
  // NOTE(mroberts): We don't support ICE restart yet.
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
