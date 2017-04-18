'use strict';

var DefaultRTCIceCandidate = require('../../webrtc/rtcicecandidate');
var DefaultRTCPeerConnection = require('../../webrtc/rtcpeerconnection');
var DefaultRTCSessionDescription = require('../../webrtc/rtcsessiondescription');
var flatMap = require('../../util').flatMap;
var getStatistics = require('../../webrtc/getstats');
var IceBox = require('./icebox');
var inherits = require('util').inherits;
var MediaClientLocalDescFailedError = require('../../util/twilio-video-errors').MediaClientLocalDescFailedError;
var MediaClientRemoteDescFailedError = require('../../util/twilio-video-errors').MediaClientRemoteDescFailedError;
var StateMachine = require('../../../lib/statemachine');
var StatsReport = require('../../stats/statsreport');

var defaults = {
  iceServers: [],
  offerOptions: {
    offerToReceiveAudio: true,
    offerToReceiveVideo: true
  },
  RTCIceCandidate: DefaultRTCIceCandidate,
  RTCPeerConnection: DefaultRTCPeerConnection,
  RTCSessionDescription: DefaultRTCSessionDescription
};

/*
PeerConnectionV2 States
-----------------------

    +------+    +--------+
    |      |    |        |
    | open |--->| closed |
    |      |    |        |
    +------+    +--------+
      |  ^          ^
      |  |          |
      |  |          |
      v  |          |
  +----------+      |
  |          |      |
  | updating |------+
  |          |
  +----------+

*/

var states = {
  open: [
    'closed',
    'updating'
  ],
  updating: [
    'closed',
    'open'
  ],
  closed: []
};

/**
 * Construct a {@link PeerConnectionV2}.
 * @class
 * @extends StateMachine
 * @param {string} id
 * @param {object} [options]
 * @property {id}
 * @fires PeerConnectionV2#candidates
 * @fires PeerConnectionV2#description
 */
function PeerConnectionV2(id, options) {
  if (!(this instanceof PeerConnectionV2)) {
    return new PeerConnectionV2(id, options);
  }
  StateMachine.call(this, 'open', states);

  options = Object.assign(defaults, options);
  var configuration = getConfiguration(options);

  var RTCPeerConnection = options.RTCPeerConnection;
  var peerConnection = new RTCPeerConnection(configuration);

  Object.defineProperties(this, {
    _descriptionRevision: {
      writable: true,
      value: 0
    },
    _localCandidates: {
      writable: true,
      value: []
    },
    _localCandidatesRevision: {
      writable: true,
      value: 1
    },
    _localDescription: {
      writable: true,
      value: null
    },
    _localUfrag: {
      writable: true,
      value: null
    },
    _needsInitialAnswer: {
      writable: true,
      value: false
    },
    _negotiationRole: {
      writable: true,
      value: null
    },
    _offerOptions: {
      writable: true,
      value: options.offerOptions
    },
    _peerConnection: {
      value: peerConnection
    },
    _queuedDescription: {
      writable: true,
      value: null
    },
    _remoteCandidates: {
      writable: true,
      value: new IceBox()
    },
    _RTCIceCandidate: {
      value: options.RTCIceCandidate
    },
    _RTCPeerConnection: {
      value: options.RTCPeerConnection
    },
    _RTCSessionDescription: {
      value: options.RTCSessionDescription
    },
    _shouldOffer: {
      writable: true,
      value: false
    },
    id: {
      enumerable: true,
      value: id
    }
  });

  peerConnection.addEventListener('icecandidate', this._handleIceCandidateEvent.bind(this));
  peerConnection.addEventListener('signalingstatechange', this._handleSignalingStateChange.bind(this));
  peerConnection.addEventListener('track', this._handleTrackEvent.bind(this));
}

inherits(PeerConnectionV2, StateMachine);

/**
 * Add an ICE candidate to the {@link PeerConnectionV2}.
 * @param {object} candidate
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype._addIceCandidate = function _addIceCandidate(candidate) {
  var self = this;
  return Promise.resolve().then(function() {
    candidate = new self._RTCIceCandidate(candidate);
    return self._peerConnection.addIceCandidate(candidate);
  });
};

/**
 * Add ICE candidates to the {@link PeerConnectionV2}.
 * @param {Array<object>} candidates
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype._addIceCandidates = function _addIceCandidates(candidates) {
  return Promise.all(candidates.map(this._addIceCandidate, this)).then(function() {});
};

/**
 * Check the {@link IceBox}.
 * @param {RTCSessionDescription} description
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype._checkIceBox = function checkIceBox(description) {
  var ufrag = getUfrag(description);
  if (!ufrag) {
    return Promise.resolve();
  }
  var candidates = this._remoteCandidates.setUfrag(ufrag);
  return this._addIceCandidates(candidates);
};

/**
 * Create an answer and set it on the {@link PeerConnectionV2}.
 * @param {object} offer
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype._answer = function _answer(offer) {
  var self = this;
  return Promise.resolve().then(function() {
    offer = new self._RTCSessionDescription(offer);
    if (!self._negotiationRole) {
      self._negotiationRole = 'answerer';
    }
    return self._peerConnection.setRemoteDescription(offer);
  }).catch(function() {
    throw new MediaClientRemoteDescFailedError();
  }).then(function() {
    return self._peerConnection.createAnswer();
  }).then(function(answer) {
    return self._setLocalDescription(answer);
  }).then(function() {
    return self._checkIceBox(offer);
  }).catch(function(error) {
    throw error instanceof MediaClientRemoteDescFailedError
      ? error
      : new MediaClientLocalDescFailedError();
  });
};

/**
 * Close the underlying RTCPeerConnection. Returns false if the
 * RTCPeerConnection was already closed.
 * @returns {boolean}
 */
PeerConnectionV2.prototype._close = function _close() {
  if (this._peerConnection.signalingState !== 'closed') {
    this._peerConnection.close();
    return true;
  }
  return false;
};

/**
 * Handle a glare scenario on the {@link PeerConnectionV2}.
 * @param {object} offer
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype._handleGlare = function _handleGlare(offer) {
  var self = this;
  return Promise.resolve().then(function() {
    var rollback = new self._RTCSessionDescription({ type: 'rollback' });
    return self._setLocalDescription(rollback);
  }).then(function() {
    return self._answer(offer);
  }).then(function() {
    return self._offer();
  });
};

/**
 * Handle an ICE candidate event.
 * @param {Event} event
 * @returns {void}
 */
PeerConnectionV2.prototype._handleIceCandidateEvent = function _handleIceCandidateEvent(event) {
  if (event.candidate) {
    this._localCandidates.push(event.candidate);
  }
  var peerConnectionState = {
    ice: {
      candidates: this._localCandidates.slice(),
      revision: this._localCandidatesRevision++,
      ufrag: this._localUfrag
    },
    id: this.id
  };
  if (!event.candidate) {
    peerConnectionState.ice.complete = true;
  }
  this.emit('candidates', peerConnectionState);
};


/**
 * Handle a signaling state change event.
 * @param {Event}
 * @returns {void}
 */
PeerConnectionV2.prototype._handleSignalingStateChange = function _handleSignalingStateChange() {
  if (this._peerConnection.signalingState === 'closed' && this.state !== 'closed') {
    this.preempt('closed');
  }
};

/**
 * Handle a track event.
 * @param {Event} event
 * @returns {void}
 */
PeerConnectionV2.prototype._handleTrackEvent = function _handleTrackEvent(event) {
  var mediaStreamTrack = event.track;
  this.emit('trackAdded', mediaStreamTrack);
};

/**
 * Create an offer and set it on the {@link PeerConnectionV2}.
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype._offer = function _offer() {
  var self = this;
  return Promise.resolve().then(function() {
    return self._peerConnection.createOffer(self._offerOptions);
  }).catch(function() {
    throw new MediaClientLocalDescFailedError();
  }).then(function(offer) {
    if (!self._negotiationRole) {
      self._negotiationRole = 'offerer';
      self._needsInitialAnswer = true;
    }
    return self._setLocalDescription(offer);
  });
};

/**
 * Set a local description on the {@link PeerConnectionV2}.
 * @param {object} description
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype._setLocalDescription = function _setLocalDescription(description) {
  var self = this;
  return Promise.resolve().then(function() {
    description = new self._RTCSessionDescription(description);
    return self._peerConnection.setLocalDescription(description);
  }).catch(function() {
    throw new MediaClientLocalDescFailedError();
  }).then(function setLocalDescriptionSucceeded() {
    if (description.type !== 'rollback') {
      self._localDescription = description;
      self._localCandidates = [];
      if (description.type === 'offer') {
        self._descriptionRevision++;
      }
      self._localUfrag = getUfrag(description);
      self.emit('description', self.getState());
    }
  });
};

/**
 * Update the {@link PeerConnectionV2}'s description.
 * @param {object} description
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype._updateDescription = function _updateDescription(description) {
  switch (description.type) {
    case 'answer':
    case 'pranswer':
      if (description.revision !== this._descriptionRevision
        || this._peerConnection.signalingState !== 'have-local-offer') {
        return Promise.resolve();
      }
      this._descriptionRevision = description.revision;
      break;
    case 'close':
      return this._close();
    case 'create-offer':
      if (description.revision < this._descriptionRevision) {
        return Promise.resolve();
      } else if (this._needsInitialAnswer) {
        this._queuedDescription = description;
        return Promise.resolve();
      }
      this._descriptionRevision = description.revision;
      return this._offer();
    case 'offer':
      if (description.revision < this._descriptionRevision
        || (this._descriptionRevision
          && description.revision === this._descriptionRevision
          && this._peerConnection.signalingState !== 'have-local-offer')
        || this._peerConnection.signalingState === 'closed') {
        return Promise.resolve();
      } else if (description.revision >= this._descriptionRevision
        && this._peerConnection.signalingState === 'have-local-offer') {
        if (this._needsInitialAnswer) {
          this._queuedDescription = description;
          return Promise.resolve();
        }
        this._descriptionRevision = description.revision;
        return this._handleGlare(description);
      }
      this._descriptionRevision = description.revision;
      return this._answer(description);
    default:
      // Do nothing.
  }

  // Handle answer or pranswer.
  var self = this;
  return Promise.resolve().then(function() {
    description = new self._RTCSessionDescription(description);
    return self._peerConnection.setRemoteDescription(description);
  }).catch(function() {
    throw new MediaClientRemoteDescFailedError();
  }).then(function() {
    if (description.type === 'answer') {
      self._needsInitialAnswer = false;
    }
    return self._checkIceBox(description);
  }).then(function() {
    return self._queuedDescription && self._updateDescription(self._queuedDescription);
  }).then(function() {
    self._queuedDescription = null;
    return self._shouldOffer && self._offer();
  }).then(function() {
    self._shouldOffer = false;
  });
};

/**
 * Update the {@link PeerConnectionV2}'s ICE candidates.
 * @param {object} iceState
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype._updateIce = function _updateIce(iceState) {
  var candidates = this._remoteCandidates.update(iceState);
  return this._addIceCandidates(candidates);
};

/**
 * Add a local MediaStream to the {@link PeerConnectionV2}.
 * @param {MediaStream} mediaStream
 * @returns {void}
 */
PeerConnectionV2.prototype.addMediaStream = function addMediaStream(mediaStream) {
  this._peerConnection.addStream(mediaStream);
};

/**
 * Close the {@link PeerConnectionV2}.
 * @returns {void}
 */
PeerConnectionV2.prototype.close = function close() {
  if (this._close()) {
    this._descriptionRevision++;
    this._localDescription = { type: 'close' };
    this.emit('description', this.getState());
  }
};

/**
 * Get remote MediaStreamTracks on the {@link PeerConnectionV2}.
 * @returns {Array<MediaStreamTracks>}
 */
PeerConnectionV2.prototype.getRemoteMediaStreamTracks = function getRemoteMediaStreamTracks() {
  return flatMap(this._peerConnection.getRemoteStreams(), function(mediaStream) {
    return mediaStream.getTracks();
  });
};

/**
 * Get the {@link PeerConnectionV2}'s state (specifically, its description).
 * @returns {?object}
 */
PeerConnectionV2.prototype.getState = function getState() {
  if (!this._localDescription) {
    return null;
  }
  var localDescription = {
    type: this._localDescription.type,
    revision: this._descriptionRevision
  };
  if (this._localDescription.sdp) {
    localDescription.sdp = this._localDescription.sdp;
  }
  return {
    description: localDescription,
    id: this.id
  };
};

/**
 * Create an offer and set it on the {@link PeerConnectionV2}.
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype.offer = function offer() {
  if (this._needsInitialAnswer) {
    this._shouldOffer = true;
    return Promise.resolve();
  }

  var self = this;
  return this.bracket('offering', function transition(key) {
    self.transition('updating', key);
    return self._offer().then(function offerSucceeded() {
      self.tryTransition('open', key);
    }, function offerFailed(error) {
      self.tryTransition('open', key);
      throw error;
    });
  });
};

/**
 * Remove a local MediaStream from the {@link PeerConnectionV2}.
 * @param {MediaStream} mediaStream
 * @returns {void}
 */
PeerConnectionV2.prototype.removeMediaStream = function removeMediaStream(mediaStream) {
  this._peerConnection.removeStream(mediaStream);
};

/**
 * Set the RTCConfiguration on the underlying RTCPeerConnection.
 * @param {RTCConfiguration} configuration
 * @returns {void}
 */
PeerConnectionV2.prototype.setConfiguration = function setConfiguration(configuration) {
  if (typeof this._peerConnection.setConfiguration === 'function') {
    this._peerConnection.setConfiguration(getConfiguration(configuration));
  }
};

/**
 * Update the {@link PeerConnectionV2}.
 * @param {object} peerConnectionState
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype.update = function update(peerConnectionState) {
  var self = this;
  return this.bracket('updating', function transition(key) {
    if (self.state === 'closed') {
      return Promise.resolve();
    }

    self.transition('updating', key);

    var updates = [];

    if (peerConnectionState.ice) {
      updates.push(self._updateIce(peerConnectionState.ice));
    }

    if (peerConnectionState.description) {
      updates.push(self._updateDescription(peerConnectionState.description));
    }

    return Promise.all(updates).then(function updatesSucceeded() {
      self.tryTransition('open', key);
    }, function updatesFailed(error) {
      self.tryTransition('open', key);
      throw error;
    });
  });
};

/**
 * Get the {@link PeerConnectionV2}'s media statistics.
 * @returns {Promise<StatsReport>}
 */
PeerConnectionV2.prototype.getStats = function getStats() {
  var self = this;
  return getStatistics(this._peerConnection).then(function(statsResponse) {
    return new StatsReport(self.id, statsResponse);
  });
};

/**
 * @event PeerConnectionV2#candidates
 * @param {object} candidates
 */

/**
 * @event PeerConnectionV2#description
 * @param {object} description
 */

/**
 * @event PeerConnectionV2#trackAdded
 * @param {MediaStreamTrack} mediaStreamTrack
 * @param {MediaStream} mediaStream
 */

function getUfrag(description) {
  if (description.sdp) {
    var match = description.sdp.match(/^a=ice-ufrag:([a-zA-Z0-9+/]+)/m);
    if (match) {
      return match[1];
    }
  }
  return null;
}

function getConfiguration(configuration) {
  return Object.assign({
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  }, configuration);
}

module.exports = PeerConnectionV2;
