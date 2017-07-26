/* globals RTCPeerConnection, RTCSessionDescription */
'use strict';

var EventTarget = require('../../eventtarget');
var inherits = require('util').inherits;
var Latch = require('../../util/latch');
var TrackMatcher = require('../../util/trackmatcher');
var updateTracksToSSRCs = require('../../util/sdp').updatePlanBTrackIdsToSSRCs;
var util = require('../../util');

function SafariRTCPeerConnection(configuration) {
  if (!(this instanceof SafariRTCPeerConnection)) {
    return new SafariRTCPeerConnection(configuration);
  }

  EventTarget.call(this);

  var oniceconnectionstatechange = null;
  var onsignalingstatechange = null;
  var ontrack = null;

  var trackMatcher = new TrackMatcher();

  var peerConnection = new RTCPeerConnection(configuration);

  Object.defineProperties(this, {
    _audioTransceiver: {
      value: null,
      writable: true
    },
    _isClosed: {
      value: false,
      writable: true
    },
    _localStreams: {
      value: new Map()
    },
    _peerConnection: {
      value: peerConnection
    },
    _pendingLocalOffer: {
      value: null,
      writable: true
    },
    _pendingRemoteOffer: {
      value: null,
      writable: true
    },
    _remoteStreams: {
      value: new Set()
    },
    _signalingStateLatch: {
      value: new Latch()
    },
    _tracksToSSRCs: {
      value: new Map()
    },
    _videoTransceiver: {
      value: null,
      writable: true
    },
    // NOTE(mroberts): Keep this here until the following is fixed.
    //
    //   https://bugs.webkit.org/show_bug.cgi?id=174323
    //
    localDescription: {
      enumerable: true,
      get: function() {
        return this._isClosed
          ? null
          : this._pendingLocalOffer || this._peerConnection.localDescription;
      }
    },
    oniceconnectionstatechange: {
      get: function() {
        return oniceconnectionstatechange;
      },
      set: function(_oniceconnectionstatechange) {
        if (oniceconnectionstatechange) {
          this.removeEventListener('iceconnectionstatechange', oniceconnectionstatechange);
        }

        if (typeof _oniceconnectionstatechange === 'function') {
          oniceconnectionstatechange = _oniceconnectionstatechange;
          this.addEventListener('iceconnectionstatechange', oniceconnectionstatechange);
        } else {
          oniceconnectionstatechange = null;
        }
      }
    },
    onsignalingstatechange: {
      get: function() {
        return onsignalingstatechange;
      },
      set: function(_onsignalingstatechange) {
        if (onsignalingstatechange) {
          this.removeEventListener('signalingstatechange', onsignalingstatechange);
        }

        if (typeof _onsignalingstatechange === 'function') {
          onsignalingstatechange = _onsignalingstatechange;
          this.addEventListener('signalingstatechange', onsignalingstatechange);
        } else {
          onsignalingstatechange = null;
        }
      }
    },
    ontrack: {
      get: function() {
        return ontrack;
      },
      set: function(_ontrack) {
        if (ontrack) {
          this.removeEventListener('track', ontrack);
        }

        if (typeof _ontrack === 'function') {
          ontrack = _ontrack;
          this.addEventListener('track', ontrack);
        } else {
          ontrack = null;
        }
      }
    },
    iceConnectionState: {
      enumerable: true,
      get: function() {
        return this._isClosed ? 'closed' : this._peerConnection.iceConnectionState;
      }
    },
    iceGatheringState: {
      enumerable: true,
      get: function() {
        return this._isClosed ? 'complete' : this._peerConnection.iceGatheringState;
      }
    },
    // NOTE(mroberts): Keep this here until the following is fixed.
    //
    //   https://bugs.webkit.org/show_bug.cgi?id=174323
    //
    remoteDescription: {
      enumerable: true,
      get: function() {
        return this._isClosed
          ? null
          : this._pendingRemoteOffer || this._peerConnection.remoteDescription;
      }
    },
    signalingState: {
      enumerable: true,
      get: function() {
        if (this._isClosed) {
          return 'closed';
        } else if (this._pendingLocalOffer) {
          return 'have-local-offer';
        } else if (this._pendingRemoteOffer) {
          return 'have-remote-offer';
        }
        return this._peerConnection.signalingState;
      }
    }
  });

  var self = this;

  peerConnection.addEventListener('iceconnectionstatechange', function oniceconnectionstatechange() {
    if (self._isClosed) {
      return;
    }
    self.dispatchEvent.apply(self, arguments);
  });

  peerConnection.addEventListener('signalingstatechange', function onsignalingstatechange() {
    if (self._isClosed) {
      return;
    }
    if (!self._pendingLocalOffer && !self._pendingRemoteOffer) {
      self.dispatchEvent.apply(self, arguments);
    }
  });

  peerConnection.addEventListener('track', function ontrack(event) {
    var sdp = self.remoteDescription ? self.remoteDescription.sdp : null;
    if (sdp) {
      trackMatcher.update(sdp);
      var id = trackMatcher.match(event.track.kind);
      if (id) {
        Object.defineProperty(event.track, 'id', {
          value: id
        });
      }
    }
    self.dispatchEvent(event);
  });

  util.proxyProperties(RTCPeerConnection.prototype, this, peerConnection);
}

inherits(SafariRTCPeerConnection, EventTarget);

SafariRTCPeerConnection.prototype.addIceCandidate = function addIceCandidate(candidate) {
  var self = this;
  if (this.signalingState === 'have-remote-offer') {
    return this._signalingStateLatch.when('low').then(function signalingStatesResolved() {
      return self._peerConnection.addIceCandidate(candidate);
    });
  }
  return this._peerConnection.addIceCandidate(candidate);
};

SafariRTCPeerConnection.prototype.createOffer = function createOffer(options) {
  options = Object.assign({}, options);
  var self = this;

  // NOTE(mroberts): In general, this is not the way to do this; however, it's
  // good enough for our application.
  if (options.offerToReceiveAudio && !this._audioTransceiver) {
    delete options.offerToReceiveAudio;
    this._audioTransceiver = this.addTransceiver('audio');
  }

  if (options.offerToReceiveVideo && !this._videoTransceiver) {
    delete options.offerToReceiveVideo;
    this._videoTransceiver = this.addTransceiver('video');
  }

  return this._peerConnection.createOffer(options).then(function(offer) {
    offer.sdp = updateTracksToSSRCs(self._tracksToSSRCs, offer.sdp);
    return offer;
  });
};

SafariRTCPeerConnection.prototype.createAnswer = function createAnswer(options) {
  var self = this;

  if (this._pendingRemoteOffer) {
    return this._peerConnection.setRemoteDescription(this._pendingRemoteOffer).then(function setRemoteDescriptionSucceeded() {
      self._signalingStateLatch.lower();
      return self._peerConnection.createAnswer();
    }).then(function createAnswerSucceeded(answer) {
      self._pendingRemoteOffer = null;
      return answer;
    }, function setRemoteDescriptionOrCreateAnswerFailed(error) {
      self._pendingRemoteOffer = null;
      throw error;
    });
  }

  return this._peerConnection.createAnswer(options);
};

SafariRTCPeerConnection.prototype.setLocalDescription = function setLocalDescription(description) {
  return setDescription(this, true, description);
};

SafariRTCPeerConnection.prototype.setRemoteDescription = function setRemoteDescription(description) {
  return setDescription(this, false, description);
};

SafariRTCPeerConnection.prototype.close = function close() {
  if (this._isClosed) {
    return;
  }
  this._isClosed = true;
  this._peerConnection.close();
  var self = this;
  setTimeout(function() {
    self.dispatchEvent(new Event('iceconnectionstatechange'));
    self.dispatchEvent(new Event('signalingstatechange'));
  });
};

SafariRTCPeerConnection.prototype.addStream = function addStream(stream) {
  if (this._localStreams.has(stream)) {
    return;
  }
  var tracks = stream.getTracks();
  tracks.forEach(function(track) {
    try {
      this.addTrack(track, stream);
    } catch (error) {
      // Do nothing.
    }
  }, this);
  this._localStreams.set(stream, new Set(tracks));
};

SafariRTCPeerConnection.prototype.removeStream = function removeStream(stream) {
  // NOTE(mroberts): We can't really remove tracks right now, at least if we
  // ever want to add them back...
  //
  //     https://bugs.webkit.org/show_bug.cgi?id=174327
  //
  // var tracks = this._localStreams.get(stream) || new Set();
  // this.getSenders().forEach(function(sender) {
  //   if (tracks.has(sender.track)) {
  //     this.removeTrack(sender);
  //   }
  // }, this);
  this._localStreams.delete(stream);
};

SafariRTCPeerConnection.prototype.getLocalStreams = function getLocalStreams() {
  return Array.from(this._localStreams.keys());
};

SafariRTCPeerConnection.prototype.getRemoteStreams = function getRemoteStreams() {
  return Array.from(this._remoteStreams);
};

util.delegateMethods(
  RTCPeerConnection.prototype,
  SafariRTCPeerConnection.prototype,
  '_peerConnection');

function setDescription(peerConnection, local, description) {
  function setPendingLocalOffer(offer) {
    if (local) {
      peerConnection._pendingLocalOffer = offer;
    } else {
      peerConnection._pendingRemoteOffer = offer;
    }
  }

  function clearPendingLocalOffer() {
    if (local) {
      peerConnection._pendingLocalOffer = null;
    } else {
      peerConnection._pendingRemoteOffer = null;
    }
  }

  var pendingLocalOffer = local ? peerConnection._pendingLocalOffer : peerConnection._pendingRemoteOffer;
  var pendingRemoteOffer = local ? peerConnection._pendingRemoteOffer : peerConnection._pendingLocalOffer;
  var intermediateState = local ? 'have-local-offer' : 'have-remote-offer';
  var setLocalDescription = local ? 'setLocalDescription' : 'setRemoteDescription';

  if (!local && pendingRemoteOffer && description.type === 'answer') {
    return setRemoteAnswer(peerConnection, description);
  } else if (description.type === 'offer') {
    if (peerConnection.signalingState !== intermediateState && peerConnection.signalingState !== 'stable') {
      return Promise.reject(new Error('Cannot set ' + (local ? 'local' : 'remote') +
        ' offer in state ' + peerConnection.signalingState));
    }

    if (!pendingLocalOffer && peerConnection._signalingStateLatch.state === 'low') {
      peerConnection._signalingStateLatch.raise();
    }
    var previousSignalingState = peerConnection.signalingState;
    setPendingLocalOffer(description);

    // Only dispatch a signalingstatechange event if we transitioned.
    if (peerConnection.signalingState !== previousSignalingState) {
      return Promise.resolve().then(function dispatchSignalingStateChangeEvent() {
        peerConnection.dispatchEvent(new Event('signalingstatechange'));
      });
    }

    return Promise.resolve();
  } else if (description.type === 'rollback') {
    if (peerConnection.signalingState !== intermediateState) {
      return Promise.reject(new Error('Cannot rollback ' +
        (local ? 'local' : 'remote') + ' description in ' + peerConnection.signalingState));
    }
    clearPendingLocalOffer();
    return Promise.resolve().then(function dispatchSignalingStateChangeEvent() {
      peerConnection.dispatchEvent(new Event('signalingstatechange'));
    });
  }

  return peerConnection._peerConnection[setLocalDescription](description);
}

function setRemoteAnswer(peerConnection, answer) {
  var pendingLocalOffer = peerConnection._pendingLocalOffer;
  return peerConnection._peerConnection.setLocalDescription(pendingLocalOffer).then(function setLocalOfferSucceeded() {
    peerConnection._pendingLocalOffer = null;
    return peerConnection.setRemoteDescription(answer);
  }).then(function setRemoteAnswerSucceeded() {
    peerConnection._signalingStateLatch.lower();
  });
}

module.exports = SafariRTCPeerConnection;
