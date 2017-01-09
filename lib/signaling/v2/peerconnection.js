'use strict';

var DefaultRTCIceCandidate = require('../../webrtc/rtcicecandidate');
var DefaultRTCPeerConnection = require('../../webrtc/rtcpeerconnection');
var DefaultRTCSessionDescription = require('../../webrtc/rtcsessiondescription');
var IceBox = require('./icebox');
var inherits = require('util').inherits;
var StateMachine = require('../../../lib/statemachine');
var getStatistics = require('../../webrtc/getstats');
var StatsReport = require('../../stats/statsreport');
var TwE = require('../../util/constants').twilioErrors;

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
    _offerOptions: {
      writable: true,
      value: options.offerOptions
    },
    _peerConnection: {
      value: peerConnection
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
 * @returns {Promise<this>}
 */
PeerConnectionV2.prototype._addIceCandidate = function _addIceCandidate(candidate) {
  var RTCIceCandidate = this._RTCIceCandidate;
  var self = this;
  return new Promise(function(resolve, reject) {
    self._peerConnection.addIceCandidate(new RTCIceCandidate(candidate), resolve, reject);
  }).then(function addIceCandidatesSucceeded() {
    return self;
  });
};

/**
 * Add ICE candidates to the {@link PeerConnectionV2}.
 * @param {Array<object>} candidates
 * @returns {Promise<this>}
 */
PeerConnectionV2.prototype._addIceCandidates = function _addIceCandidates(candidates) {
  var self = this;
  return Promise.all(
    candidates.map(this._addIceCandidate, this)
  ).then(function addIceCandidatesSucceeded() {
    return self;
  });
};

/**
 * Create an answer and set it on the {@link PeerConnectionV2}.
 * @param {object} offer
 * @returns {Promise<this>}
 */
PeerConnectionV2.prototype._answer = function _answer(offer) {
  var RTCSessionDescription = this._RTCSessionDescription;
  var self = this;
  return new Promise(function(resolve, reject) {
    var description = new RTCSessionDescription(offer);
    var _reject = reject.bind(null, new TwE.MEDIA_CLIENT_REMOTE_DESC_FAILED());
    self._peerConnection.setRemoteDescription(description, resolve, _reject);
  }).then(function setRemoteDescriptionSucceeded() {
    var ufrag = getUfrag(offer);
    if (ufrag) {
      var candidates = self._remoteCandidates.setUfrag(ufrag);
      self._addIceCandidates(candidates);
    }

    return new Promise(function(resolve, reject) {
      var _reject = reject.bind(null, new TwE.MEDIA_CLIENT_LOCAL_DESC_FAILED());
      self._peerConnection.createAnswer(resolve, _reject);
    });
  }).then(function createAnswerSucceeded(answer) {
    return self._setLocalDescription(answer);
  }).then(function setLocalDescriptionSucceeded() {
    return self;
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
 * @returns {Promise<this>}
 */
PeerConnectionV2.prototype._handleGlare = function _handleGlare(offer) {
  var RTCSessionDescription = this._RTCSessionDescription;
  var rollback = new RTCSessionDescription({ type: 'rollback' });
  var self = this;
  return this._setLocalDescription(rollback).then(function setLocalDescriptionSucceeded() {
    return self._answer(offer);
  }).then(function answerSucceeded() {
    return self._offer();
  });
};

/**
 * Handle an ICE candidate event.
 * @param {Event} event
 * @returns {undefined}
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
 * @returns {undefined}
 */
PeerConnectionV2.prototype._handleSignalingStateChange = function _handleSignalingStateChange() {
  if (this._peerConnection.signalingState === 'closed' && this.state !== 'closed') {
    this.preempt('closed');
  }
};

/**
 * Handle a track event.
 * @param {Event} event
 * @returns {undefined}
 */
PeerConnectionV2.prototype._handleTrackEvent = function _handleTrackEvent(event) {
  var mediaStreamTrack = event.track;
  var mediaStream = event.streams[0];
  this.emit('trackAdded', mediaStreamTrack, mediaStream);
};

/**
 * Create an offer and set it on the {@link PeerConnectionV2}.
 * @returns {Promise<this>}
 */
PeerConnectionV2.prototype._offer = function _offer() {
  var self = this;
  return new Promise(function(resolve, reject) {
    var _reject = reject.bind(null, new TwE.MEDIA_CLIENT_LOCAL_DESC_FAILED());
    self._peerConnection.createOffer(resolve, _reject, self._offerOptions);
  }).then(function createOfferSucceeded(offer) {
    return self._setLocalDescription(offer);
  });
};

/**
 * Set a local description on the {@link PeerConnectionV2}.
 * @param {object} description
 * @returns {this}
 */
PeerConnectionV2.prototype._setLocalDescription = function _setLocalDescription(description) {
  var RTCSessionDescription = this._RTCSessionDescription;
  var self = this;
  return new Promise(function(resolve, reject) {
    var _reject = reject.bind(null, new TwE.MEDIA_CLIENT_LOCAL_DESC_FAILED());
    self._peerConnection.setLocalDescription(new RTCSessionDescription(description), resolve, _reject);
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
    return self;
  });
};

/**
 * Update the {@link PeerConnectionV2}'s description.
 * @param {object} description
 * @returns {Promise<this>}
 */
PeerConnectionV2.prototype._updateDescription = function _updateDescription(description) {
  switch (description.type) {
    case 'answer':
    case 'pranswer':
      if (description.revision !== this._descriptionRevision ||
          this._peerConnection.signalingState !== 'have-local-offer') {
        return Promise.resolve(this);
      }
      this._descriptionRevision = description.revision;
      break;
    case 'close':
      if ((description.revision < this._descriptionRevision) ||
          (description.revision === this._descriptionRevision &&
           this._peerConnection.signalingState !== 'have-local-offer') ||
          (this._peerConnection.signalingState === 'closed')) {
        return Promise.resolve(this);
      }
      return this._close();
    case 'create-offer':
      if (description.revision <= this._descriptionRevision ||
          this._peerConnection.signalingState !== 'stable') {
        return Promise.resolve(this);
      }
      this._descriptionRevision = description.revision;
      return this._offer();
    case 'offer':
      if (description.revision < this._descriptionRevision ||
          (description.revision === this._descriptionRevision &&
           this._peerConnection.signalingState !== 'have-local-offer') ||
          this._peerConnection.signalingState === 'closed') {
        return Promise.resolve(this);
      } else if (description.revision >= this._descriptionRevision &&
                 this._peerConnection.signalingState === 'have-local-offer') {
        this._descriptionRevision = description.revision;
        return this._handleGlare(description);
      }
      this._descriptionRevision = description.revision;
      return this._answer(description);
    default:
      // Do nothing.
  }

  // Handle answer or pranswer.
  var RTCSessionDescription = this._RTCSessionDescription;
  var self = this;
  return new Promise(function(resolve, reject) {
    var _reject = reject.bind(null, new TwE.MEDIA_CLIENT_REMOTE_DESC_FAILED());
    self._peerConnection.setRemoteDescription(new RTCSessionDescription(description), resolve, _reject);
  }).then(function setRemoteDescriptionSucceeded() {
    var ufrag = getUfrag(description);
    if (ufrag) {
      var candidates = self._remoteCandidates.setUfrag(ufrag);
      return self._addIceCandidates(candidates);
    }
    return self;
  });
};

/**
 * Update the {@link PeerConnectionV2}'s ICE candidates.
 * @param {object} iceState
 * @returns {Promise<this>}
 */
PeerConnectionV2.prototype._updateIce = function _updateIce(iceState) {
  var candidates = this._remoteCandidates.update(iceState);
  return this._addIceCandidates(candidates);
};

/**
 * Add a local MediaStream to the {@link PeerConnectionV2}.
 * @param {MediaStream} mediaStream
 * @returns {this}
 */
PeerConnectionV2.prototype.addMediaStream = function addMediaStream(mediaStream) {
  this._peerConnection.addStream(mediaStream);
  return this;
};

/**
 * Close the {@link PeerConnectionV2}.
 * @returns {this}
 */
PeerConnectionV2.prototype.close = function close() {
  if (this._close()) {
    this._descriptionRevision++;
    this._localDescription = { type: 'close' };
    this.emit('description', this.getState());
  }
  return this;
};

/**
 * Get remote MediaStreams on the {@link PeerConnectionV2}.
 * @returns {Array<MediaStream>}
 */
PeerConnectionV2.prototype.getRemoteMediaStreams = function getRemoteMediaStreams() {
  return this._peerConnection.getRemoteStreams();
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
 * @returns {Promise<this>}
 */
PeerConnectionV2.prototype.offer = function offer() {
  var self = this;
  return this.bracket('offering', function transition(key) {
    self.transition('updating', key);
    return self._offer().then(function offerSucceeded() {
      self.tryTransition('open', key);
      return self;
    }, function offerFailed(error) {
      self.tryTransition('open', key);
      throw error;
    });
  });
};

/**
 * Remove a local MediaStream from the {@link PeerConnectionV2}.
 * @param {MediaStream} mediaStream
 * @returns {this}
 */
PeerConnectionV2.prototype.removeMediaStream = function removeMediaStream(mediaStream) {
  this._peerConnection.removeStream(mediaStream);
  return this;
};

/**
 * Set the RTCConfiguration on the underlying RTCPeerConnection.
 * @returns {this}
 */
PeerConnectionV2.prototype.setConfiguration = function setConfiguration(configuration) {
  if (typeof this._peerConnection.setConfiguration === 'function') {
    this._peerConnection.setConfiguration(getConfiguration(configuration));
  }
  return this;
};

/**
 * Update the {@link PeerConnectionV2}.
 * @param {object} peerConnectionState
 * @returns {Promise<this>}
 */
PeerConnectionV2.prototype.update = function update(peerConnectionState) {
  var self = this;
  return this.bracket('updating', function transition(key) {
    if (self.state === 'closed') {
      return Promise.resolve(self);
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
      return self;
    }, function updatesFailed(error) {
      self.tryTransition('open', key);
      throw error;
    });
  });
};

/**
 * Get the {@link PeerConnectionV2}'s media statistics.
 * @returns {Promise.<StatsReport>}
 */
PeerConnectionV2.prototype.getStats = function getStats() {
  var self = this;
  return getStatistics(this._peerConnection)
    .then(function(statsResponse) {
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
