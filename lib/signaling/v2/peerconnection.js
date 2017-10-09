'use strict';

var WebRTC = require('@twilio/webrtc');
var DefaultRTCIceCandidate = WebRTC.RTCIceCandidate;
var DefaultRTCPeerConnection = WebRTC.RTCPeerConnection;
var DefaultRTCSessionDescription = WebRTC.RTCSessionDescription;
var flatMap = require('../../util').flatMap;
var getStatistics = WebRTC.getStats;
var getMediaSections = require('../../util/sdp').getMediaSections;
var guessBrowser = require('../../util').guessBrowser;
var oncePerTick = require('../../util').oncePerTick;
var setBitrateParameters = require('../../util/sdp').setBitrateParameters;
var setCodecPreferences = require('../../util/sdp').setCodecPreferences;
var IceBox = require('./icebox');
var inherits = require('util').inherits;
var MediaClientLocalDescFailedError = require('../../util/twilio-video-errors').MediaClientLocalDescFailedError;
var MediaClientRemoteDescFailedError = require('../../util/twilio-video-errors').MediaClientRemoteDescFailedError;
var DataTrackReceiver = require('../../data/receiver');
var StateMachine = require('../../../lib/statemachine');
var StatsReport = require('../../stats/statsreport');

var defaults = {
  iceServers: [],
  offerOptions: {},
  setBitrateParameters: setBitrateParameters,
  setCodecPreferences: setCodecPreferences,
  RTCIceCandidate: DefaultRTCIceCandidate,
  RTCPeerConnection: DefaultRTCPeerConnection,
  RTCSessionDescription: DefaultRTCSessionDescription
};

var isFirefox = guessBrowser() === 'firefox';

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
 * @param {EncodingParametersImpl} encodingParameters
 * @param {PreferredCodecs} preferredCodecs
 * @param {object} [options]
 * @property {id}
 * @fires PeerConnectionV2#candidates
 * @fires PeerConnectionV2#description
 */
function PeerConnectionV2(id, encodingParameters, preferredCodecs, options) {
  if (!(this instanceof PeerConnectionV2)) {
    return new PeerConnectionV2(id, encodingParameters, preferredCodecs, options);
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
    _encodingParameters: {
      value: encodingParameters
    },
    _lastStableDescriptionRevision: {
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
    _dataTrackSenders: {
      value: new Map()
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
    _preferredAudioCodecs: {
      value: preferredCodecs.audio
    },
    _preferredVideoCodecs: {
      value: preferredCodecs.video
    },
    _queuedDescription: {
      writable: true,
      value: null
    },
    _dataTrackReceivers: {
      value: new Set()
    },
    _remoteCandidates: {
      writable: true,
      value: new IceBox()
    },
    _setBitrateParameters: {
      value: options.setBitrateParameters
    },
    _setCodecPreferences: {
      value: options.setCodecPreferences
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

  encodingParameters.on('changed', oncePerTick(this.offer.bind(this)));
  peerConnection.addEventListener('datachannel', this._handleDataChannelEvent.bind(this));
  peerConnection.addEventListener('icecandidate', this._handleIceCandidateEvent.bind(this));
  peerConnection.addEventListener('signalingstatechange', this._handleSignalingStateChange.bind(this));
  peerConnection.addEventListener('track', this._handleTrackEvent.bind(this));

  var self = this;
  this.on('stateChanged', function stateChanged(state) {
    if (state !== 'closed') {
      return;
    }
    self.removeListener('stateChanged', stateChanged);
    self._dataTrackSenders.forEach(function(dataChannel, dataTrackSender) {
      self.removeDataTrackSender(dataTrackSender);
    });
  });
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
 * @param {RTCSessionDescriptionInit} description
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
 * @param {RTCSessionDescriptionInit} offer
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype._answer = function _answer(offer) {
  var self = this;
  return Promise.resolve().then(function() {
    if (!self._negotiationRole) {
      self._negotiationRole = 'answerer';
    }
    return self._setRemoteDescription(offer);
  }).catch(function() {
    throw new MediaClientRemoteDescFailedError();
  }).then(function() {
    return self._peerConnection.createAnswer();
  }).then(function(answer) {
    return self._setLocalDescription(answer);
  }).then(function() {
    return self._checkIceBox(offer);
  }).then(function() {
    return self._maybeReoffer(offer);
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
 * Handle a "datachannel" event.
 * @param {RTCDataChannelEvent} event
 * @returns {void}
 */
PeerConnectionV2.prototype._handleDataChannelEvent = function _handleDataChannelEvent(event) {
  var dataChannel = event.channel;
  var dataTrackReceiver = new DataTrackReceiver(dataChannel);
  this._dataTrackReceivers.add(dataTrackReceiver);

  var self = this;
  dataChannel.addEventListener('close', function() {
    self._dataTrackReceivers.delete(dataTrackReceiver);
  });

  this.emit('trackAdded', dataTrackReceiver);
};

/**
 * Handle a glare scenario on the {@link PeerConnectionV2}.
 * @param {RTCSessionDescriptionInit} offer
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
 * Conditionally re-offer.
 * @param {RTCSessionDescriptionInit} offer
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype._maybeReoffer = function _maybeReoffer(offer) {
  var shouldReoffer = this._shouldOffer;

  // NOTE(mmalavalli): In Firefox, if the remote RTCPeerConnection sends
  // an offer with fewer audio m= lines than the number of audio RTCRTPSenders
  // in the local RTCPeerConnection, then the local RTCPeerConnection creates
  // an answer with the same number of audio m= lines as in the offer. This
  // behavior was triggered by the removal of 'offerToReceiveAudio' from the
  // default RTCOfferOptions. Ideally, the local RTCPeerConnection should create
  // an answer with the same number of audio m= lines as the number of
  // RTCRTPSenders. In order to achieve this,the local RTCPeerConnection
  // initiates renegotiation.
  //
  // We can reduce the number of cases where renegotiation is needed by
  // re-introducing 'offerToReceiveAudio' to the default RTCOfferOptions with a
  // value > 1.
  if (isFirefox) {
    var senders = this._peerConnection.getSenders();
    shouldReoffer = ['audio', 'video'].reduce(function(shouldOffer, kind) {
      var mediaSections = getMediaSections(offer.sdp, kind, '(sendrecv|recvonly)');
      var sendersOfKind = senders.filter(isSenderOfKind.bind(null, kind));
      return shouldOffer || (mediaSections.length < sendersOfKind.length);
    }, shouldReoffer);
  }

  // NOTE(mroberts): We also need to re-offer if we have a DataTrack to share
  // but no m= application section.
  var hasDataTrack = this._dataTrackSenders.size > 0;
  var hasApplicationMediaSection = getMediaSections(offer.sdp, 'application').length > 0;
  var needsApplicationMediaSection = hasDataTrack && !hasApplicationMediaSection;
  shouldReoffer = shouldReoffer || needsApplicationMediaSection;

  return shouldReoffer ? this._offer() : Promise.resolve();
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
    var updatedSdp = self._setCodecPreferences(
      offer.sdp,
      self._preferredAudioCodecs,
      self._preferredVideoCodecs);
    var updatedOffer = new RTCSessionDescription({
      type: 'offer',
      sdp: updatedSdp
    });
    self._shouldOffer = false;
    if (!self._negotiationRole) {
      self._negotiationRole = 'offerer';
      self._needsInitialAnswer = true;
    }
    return self._setLocalDescription(updatedOffer);
  });
};

/**
 * Set a local description on the {@link PeerConnectionV2}.
 * @param {RTCSessionDescriptionInit} description
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype._setLocalDescription = function _setLocalDescription(description) {
  var revision = description.revision;
  var self = this;
  return Promise.resolve().then(function() {
    description = new self._RTCSessionDescription(description);
    if (description.type === 'answer') {
      self._lastStableDescriptionRevision = revision;
    }
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
 * Set a remote RTCSessionDescription on the {@link PeerConnectionV2}.
 * @param {RTCSessionDescriptionInit} description
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype._setRemoteDescription = function _setRemoteDescription(description) {
  if (description.sdp) {
    description.sdp = this._setBitrateParameters(
      description.sdp,
      guessBrowser() === 'firefox' ? 'TIAS' : 'AS',
      this._encodingParameters.maxAudioBitrate,
      this._encodingParameters.maxVideoBitrate);
    description.sdp = this._setCodecPreferences(
      description.sdp,
      this._preferredAudioCodecs,
      this._preferredVideoCodecs);
  }
  description = new this._RTCSessionDescription(description);
  return this._peerConnection.setRemoteDescription(description);
};

/**
 * Update the {@link PeerConnectionV2}'s description.
 * @param {RTCSessionDescriptionInit} description
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
      if (description.revision <= this._lastStableDescriptionRevision) {
        return Promise.resolve();
      } else if (this._needsInitialAnswer) {
        this._queuedDescription = description;
        return Promise.resolve();
      }
      this._descriptionRevision = description.revision;
      return this._offer();
    case 'offer':
      if (description.revision <= this._lastStableDescriptionRevision
        || this._peerConnection.signalingState === 'closed') {
        return Promise.resolve();
      }
      if (this._peerConnection.signalingState === 'have-local-offer') {
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
  var revision = description.revision;
  var self = this;
  return Promise.resolve().then(function() {
    if (description.type === 'answer') {
      self._lastStableDescriptionRevision = revision;
    }
    return self._setRemoteDescription(description);
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
    var offer = self._peerConnection.localDescription && self._peerConnection.localDescription.type === 'offer'
      ? self._peerConnection.localDescription
      : self._peerConnection.remoteDescription && self._peerConnection.remoteDescription.type === 'offer'
        ? self._peerConnection.remoteDescription
        : null;
    if (offer) {
      return self._maybeReoffer(offer);
    }
    return Promise.resolve();
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
 * Add a {@link DataTrackSender} to the {@link PeerConnectionV2}.
 * @param {DataTrackSender} dataTrackSender
 * @returns {void}
 */
PeerConnectionV2.prototype.addDataTrackSender = function addDataTrackSender(dataTrackSender) {
  if (this._dataTrackSenders.has(dataTrackSender)) {
    return;
  }
  try {
    var dataChannel = this._peerConnection.createDataChannel(dataTrackSender.id, {
      maxPacketLifeTime: dataTrackSender.maxPacketLifeTime,
      maxRetransmits: dataTrackSender.maxRetransmits,
      ordered: dataTrackSender.ordered
    });
    dataTrackSender.addDataChannel(dataChannel);
    this._dataTrackSenders.set(dataTrackSender, dataChannel);
  } catch (error) {
    // Do nothing.
  }
};

/**
 * Add a local MediaStream to the {@link PeerConnectionV2}.
 * @param {MediaStream} mediaStream
 * @returns {void}
 */
PeerConnectionV2.prototype.addMediaStream = function addMediaStream(mediaStream) {
  if (this._peerConnection.signalingState !== 'closed') {
    this._peerConnection.addStream(mediaStream);
  }
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
 * Get the {@link DataTrackReceivers} on the {@link PeerConnectionV2}.
 * @returns {Array<DataTrackReceiver>} dataTrackReceivers
 */
PeerConnectionV2.prototype.getDataTrackReceivers = function getDataTrackReceivers() {
  return Array.from(this._dataTrackReceivers);
};

/**
 * Get the remote MediaStreamTracks and {@link DataTrackReceiver}s on the
 * {@link PeerConnectionV2}.
 * @returns {Array<MediaStreamTrack|DataTrackReceiver>} mediaStreamTracksAndDataTrackReceivers
 */
PeerConnectionV2.prototype.getRemoteMediaStreamTracksAndDataTrackReceivers = function getRemoteMediaStreamTracksAndDataTrackReceivers() {
  return this.getRemoteMediaStreamTracks().concat(this.getDataTrackReceivers());
};

/**
 * Get the remote MediaStreamTracks on the {@link PeerConnectionV2}.
 * @returns {Array<MediaStreamTrack>} mediaStreamTracks
 */
PeerConnectionV2.prototype.getRemoteMediaStreamTracks = function getRemoteMediaStreamTracks() {
  if (this._peerConnection.getReceivers) {
    return this._peerConnection.getReceivers().map(function(receiver) {
      return receiver.track;
    }).filter(function(track) {
      return track;
    });
  }
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
 * Remove a {@link DataTrackSender} from the {@link PeerConnectionV2}.
 * @param {DataTrackSender} dataTrackSender
 * @returns {void}
 */
PeerConnectionV2.prototype.removeDataTrackSender = function removeDataTrackSender(dataTrackSender) {
  var dataChannel = this._dataTrackSenders.get(dataTrackSender);
  if (dataChannel) {
    dataTrackSender.removeDataChannel(dataChannel);
    this._dataTrackSenders.delete(dataTrackSender);
  }
};

/**
 * Remove a local MediaStream from the {@link PeerConnectionV2}.
 * @param {MediaStream} mediaStream
 * @returns {void}
 */
PeerConnectionV2.prototype.removeMediaStream = function removeMediaStream(mediaStream) {
  if (this._peerConnection.signalingState !== 'closed') {
    this._peerConnection.removeStream(mediaStream);
  }
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
 * @param {MediaStreamTrack|DataTrackReceiver} mediaStreamTrackOrDataTrackReceiver
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

/**
 * Whether the MediaStreamTrack of the given RTCRTPSender is a non-ended
 * MediaStreamTrack of a given kind.
 * @private
 * @param {string} kind
 * @param {RTCRTPSender} sender
 * @return {boolean}
 */
function isSenderOfKind(kind, sender) {
  var track = sender.track;
  return track && track.kind === kind && track.readyState !== 'ended';
}

/**
 * Preferred codecs.
 * @typedef {object} PreferredCodecs
 * @property {Array<AudioCodec>} audio
 * @property {Array<VideoCodec>} video
 */

module.exports = PeerConnectionV2;
