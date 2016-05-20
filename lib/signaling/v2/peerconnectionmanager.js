'use strict';

var inherits = require('util').inherits;
var QueueingEventEmitter = require('../../queueingeventemitter');
var SIP = require('sip.js');
var util = require('../../util');

// After calling setLocalDescription, we'll wait up to 10 seconds for ICE
// gathering to complete. Once we support Trickle ICE, we can remove this.
var ICE_GATHERING_TIMEOUT = 10 * 1000;

// The PeerConnectionManager will create one offer by default when it is
// initiating (see setConfiguration).
var INITIAL_OFFERS = 1;

/**
 * Construct a {@link PeerConnectionManager}.
 * @class
 * @classdesc A {@link PeerConnectionManager} manages multiple
 * RTCPeerConnections, can be updated with Conversation Info, and emits
 * Conversation Info.
 * @emits PeerConnectionManager#conversationInfo
 */
function PeerConnectionManager(options) {
  if (!(this instanceof PeerConnectionManager)) {
    return new PeerConnectionManager();
  }
  QueueingEventEmitter.call(this);

  SIP.WebRTC.isSupported();

  options = Object.assign({
    iceGatheringTimeout: ICE_GATHERING_TIMEOUT,
    initialOffers: INITIAL_OFFERS,
    RTCPeerConnection: SIP.WebRTC.RTCPeerConnection,
    RTCSessionDescription: SIP.WebRTC.RTCSessionDescription
  }, options);

  Object.defineProperties(this, {
    _changedPeerConnections: {
      value: new Set()
    },
    _configurationIsSet: {
      value: false,
      writable: true
    },
    _iceGatheringTimeout: {
      value: options.iceGatheringTimeout
    },
    _iceServers: {
      value: null,
      writable: true
    },
    _iceTransportPolicy: {
      value: null,
      writable: true
    },
    _initialOffers: {
      value: options.initialOffers
    },
    _isInitiator: {
      value: null,
      writable: true
    },
    _localStreams: {
      value: new Set()
    },
    _peerConnections: {
      value: new Map()
    },
    _pendingCreateOffers: {
      value: new Set()
    },
    _pendingRemoteOffers: {
      value: new Map()
    },
    _remoteTracks: {
      value: new Map()
    },
    _RTCPeerConnection: {
      value: options.RTCPeerConnection
    },
    _RTCSessionDescription: {
      value: options.RTCSessionDescription
    }
  });
}

inherits(PeerConnectionManager, QueueingEventEmitter);

/**
 * Add a remote MediaStreamTrack.
 * @private
 * @param {MediaStreamTrack} track
 * @param {MediaStream} stream
 * @fires PeerConnectionManager#trackAdded
 */
PeerConnectionManager.prototype._addRemoteTrack = function _addRemoteTrack(track, stream) {
  this._remoteTracks.set(track.id, track);
  this.queue('trackAdded', track, stream);
};

/**
 * Close an RTCPeerConnection by ID.
 * @private
 * @param {string} id
 * @throws {Error}
 */
PeerConnectionManager.prototype._close = function _close(id) {
  var peerConnection = this._get(id);
  peerConnection.close();
  this._changedPeerConnections.delete(id);
  this._peerConnections.delete(id);
};

/**
 * Create an RTCPeerConnection with the given ID. If no ID is provided, a
 * unique ID will be assigned.
 * @private
 * @param {?string} [id=null] - the ID to assign to the new RTCPeerConnection
 * @throws {Error}
 */
PeerConnectionManager.prototype._create = function _create(id) {
  if (id === null || typeof id === 'undefined') {
    id = util.makeUUID();
  }
  if (this._has(id)) {
    throw new Error('PeerConnection ' + id + ' already exists');
  }
  var configuration = this._getConfiguration();
  var peerConnection = new this._RTCPeerConnection(configuration);
  this._localStreams.forEach(function addStream(stream) {
    peerConnection.addStream(stream);
  });
  this._peerConnections.set(id, peerConnection);
};

/**
 * Create an answer for an RTCPeerConnection by ID.
 * @private
 * @param {string} id
 * @returns {Promise}
 */
PeerConnectionManager.prototype._createAnswer = function _createAnswer(id) {
  var self = this;
  return new Promise(function createAnswer(resolve, reject) {
    var peerConnection = self._get(id);
    peerConnection.createAnswer(resolve, reject);
  }).then(function createAnswerSucceeded(description) {
    return self._setLocalDescription(id, description);
  });
};

/**
 * Create an offer for an RTCPeerConnection by ID.
 * @private
 * @param {string} id
 * @returns {Promise}
 */
PeerConnectionManager.prototype._createOffer = function _createOffer(id) {
  var self = this;
  return new Promise(function createOffer(resolve, reject) {
    var peerConnection = self._get(id);
    peerConnection.createOffer(resolve, reject, {
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
  }).then(function createOfferSucceeded(description) {
    return self._setLocalDescription(id, description);
  });
};

/**
 * Get the RTCConfiguration to use across RTCPeerConnections.
 * @private
 * @returns {RTCConfiguration}
 * @throws {Error}
 */
PeerConnectionManager.prototype._getConfiguration = function _getConfiguration() {
  if (!this._configurationIsSet) {
    throw new Error('Call setConfiguration first');
  }
  var configuration = {
    iceServers: this._iceServers
  };
  if (this._iceTransportPolicy) {
    configuration.iceTransportPolicy = this._iceTransportPolicy;
  }
  return configuration;
};

/**
 * Get the RTCPeerConnection with the given ID.
 * @private
 * @param {string} id
 * @returns {RTCPeerConnection}
 * @throws {Error}
 */
PeerConnectionManager.prototype._get = function _get(id) {
  var peerConnection = this._peerConnections.get(id);
  if (!peerConnection) {
    throw new Error('PeerConnection ' + id + ' does not exist');
  }
  return peerConnection;
};

/**
 * Check if the {@link PeerConnectionManager} already has an RTCPeerConnection
 * with the given ID.
 * @private
 * @param {string} id
 * @returns {boolean}
 */
PeerConnectionManager.prototype._has = function _has(id) {
  return this._peerConnections.has(id);
};

/**
 * Remove a remote MediaStreamTrack.
 * @private
 * @param {MediaStreamTrack} track
 * @fires PeerConnectionManager#trackRemoved
 */
PeerConnectionManager.prototype._removeRemoteTrack = function _removeRemoteTrack(track) {
  this._remoteTracks.delete(track.id);
  this.emit('trackRemoved', track);
};

/**
 * Set the local description for an RTCPeerConnection with the given ID.
 * @private
 * @param {string} id
 * @param {RTCSessionDescription} description
 * @returns {Promise}
 */
PeerConnectionManager.prototype._setLocalDescription = function _setLocalDescription(id, description) {
  var self = this;
  var peerConnection;
  return new Promise(function setLocalDescription(resolve, reject) {
    peerConnection = self._get(id);
    peerConnection.setLocalDescription(description, resolve, reject);
  }).then(function setLocalDescriptionSucceeded() {
    return new Promise(function waitForIceCandidates(resolve) {
      if (peerConnection.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      peerConnection.onicecandidate = function onicecandidate(event) {
        if (!event.candidate) {
          resolve();
        }
      };
      setTimeout(resolve, self._iceGatheringTimeout);
    });
  }).then(function gotIceCandidates() {
    self._changedPeerConnections.add(id);
  });
};

/**
 * Set the remote description for an RTCPeerConnection with the given ID.
 * @private
 * @param {string} id
 * @param {RTCSessionDescription} description
 * @returns {Promise}
 */
PeerConnectionManager.prototype._setRemoteDescription = function _setRemoteDescription(id, description) {
  var peerConnection;
  var self = this;
  return new Promise(function setRemoteDescription(resolve, reject) {
    peerConnection = self._get(id);
    var sessionDescription = new self._RTCSessionDescription(description);
    peerConnection.setRemoteDescription(sessionDescription, resolve, reject);
  }).then(function setRemoteDescriptionSucceeded() {
    if (peerConnection.signalingState === 'have-remote-offer') {
      return self._createAnswer(id);
    }
  });
};

/**
 * Update the set of remote MediaStreamTracks we _think_ we are receiving based
 * one what the RTCPeerConnections actually report when we call
 * <code>getRemoteStreams</code>.
 * @fires PeerConnectionManager#trackAdded
 * @fires PeerConnectionManager#trackRemoved
 */
PeerConnectionManager.prototype._updateRemoteTracks = function _updateRemoteTracks() {
  var newRemoteTracks = new Map();

  // First, record the remote MediaStreamTracks and add any new ones.
  this._peerConnections.forEach(function(peerConnection) {
    peerConnection.getRemoteStreams().forEach(function(stream) {
      stream.getTracks().forEach(function(track) {
        newRemoteTracks.set(track.id, track);
        if (!this._remoteTracks.has(track.id)) {
          this._addRemoteTrack(track, stream);
        }
      }, this);
    }, this);
  }, this);

  // Then, remove any removed remote MediaStreamTracks.
  this._remoteTracks.forEach(function(track, id) {
    if (!newRemoteTracks.has(id)) {
      this._removeRemoteTrack(track);
    }
  }, this);
};

/**
 * Add a local MediaStream to the {@link PeerConnectionManager}'s underlying
 * RTCPeerConnections.
 * @param {MediaStream} stream
 */
PeerConnectionManager.prototype.addStream = function addStream(stream) {
  this._localStreams.add(stream);
  this._peerConnections.forEach(function(peerConnection) {
    peerConnection.addStream(stream);
  });
};

/**
 * Close the {@link PeerConnectionManager} and all RTCPeerConnections.
 */
PeerConnectionManager.prototype.close = function close() {
  Array.from(this._peerConnections.keys()).forEach(this._close, this);
};

/**
 * Get Conversation Info describing the most recent change to the state of the
 * {@link PeerConnectionManager}.
 * @returns {?object}
 */
PeerConnectionManager.prototype.getConversationInfo = function getConversationInfo() {
  if (!this._changedPeerConnections.size) {
    return null;
  }

  var peerConnections = [];
  this._changedPeerConnections.forEach(function(id) {
    var peerConnection = this._get(id);
    var localDescription = peerConnection.localDescription;
    if (!localDescription) {
      return;
    }
    peerConnections.push({
      id: id,
      description: {
        type: localDescription.type,
        sdp: localDescription.sdp
      }
    });
  }, this);

  return {
    protocol_version: 'v2',
    peer_connections: peerConnections
  };
};

/**
 * Remove a local MediaStream from the {@link PeerConnectionManager}'s
 * underlying RTCPeerConnections.
 * @param {MediaStream} stream
 */
PeerConnectionManager.prototype.removeStream = function removeStream(stream) {
  this._localStreams.delete(stream);
  this._peerConnections.forEach(function(peerConnection) {
    try {
      peerConnection.removeStream(stream);
    } catch (error) {
      // Firefox doesn't support removeStream yet; do nothing.
      void error;
    }
  });
};

/**
 * Renegotiate the {@link PeerConnectionManager}'s underlying
 * RTCPeerConnections. If MediaStreams are provided, this will override the
 * MediaStreams being shared.
 * @param {?Array<MediaStream>} [streams]
 * @returns <Promise>
 */
PeerConnectionManager.prototype.renegotiate = function renegotiate(streams) {
  this._localStreams.forEach(this.removeStream, this);
  (streams || this._localStreams).forEach(this.addStream, this);
  return Promise.all(
    Array.from(this._peerConnections.keys()).map(this._createOffer, this)
  ).then(function() {
    // Do nothing
  });
};

/**
 * Set the RTCConfiguration to use across RTCPeerConnections.
 * @param {RTCConfiguration} configuration
 */
PeerConnectionManager.prototype.setConfiguration = function setConfiguration(configuration) {
  this._iceServers = configuration.iceServers;
  if ('iceTransportPolicy' in configuration) {
    this._iceTransportPolicy = configuration.iceTransportPolicy;
  }

  if (!this._configurationIsSet) {
    this._configurationIsSet = true;
    this._isInitiator = this._isInitiator === null ? true : this._isInitiator;

    // If we are initiating, queue the specified number of "create-offers"
    // (these will be applied below).
    if (this._isInitiator) {
      for (var i = 0; i < this._initialOffers; i++) {
        this._pendingCreateOffers.add(util.makeUUID());
      }
    }
  }

  var promises = [];
  var self = this;

  // Apply any queued "create-offer" descriptions.
  this._pendingCreateOffers.forEach(function(id) {
    promises.push(new Promise(function(resolve) {
      self._create(id);
      resolve(self._createOffer(id));
    }));
  });
  this._pendingCreateOffers.clear();

  // Apply any queued "offer" descriptions.
  this._pendingRemoteOffers.forEach(function(description, id) {
    promises.push(new Promise(function(resolve) {
      self._create(id);
      resolve(self._setRemoteDescription(id, description));
    }));
  });
  this._pendingRemoteOffers.clear();

  return Promise.all(promises).then(function setConfigurationSucceeded() {
    self._updateRemoteTracks(self._peerConnections);
  });
};

/**
 * Notify the {@link PeerConnectionManager} of new Conversation Info. This may
 * or may not trigger changes to the underlying RTCPeerConnections.
 * @param {object} conversationInfo
 * @returns {Promise}
 */
PeerConnectionManager.prototype.update = function update(conversationInfo) {
  this._isInitiator = this._isInitiator === null ? false : this._isInitiator;
  this._changedPeerConnections.clear();

  /* eslint camelcase:0, consistent-return:0, dot-notation:0 */
  if (typeof conversationInfo !== 'object') {
    return Promise.resolve();
  }

  var peerConnections = conversationInfo['peer_connections'];
  if (!(peerConnections instanceof Array)) {
    return Promise.resolve();
  }

  var self = this;
  return Promise.all(peerConnections.map(function(peerConnection) {
    if (typeof peerConnection !== 'object') {
      return;
    }

    var description = peerConnection['description'];
    if (typeof description !== 'object') {
      return;
    }

    var id = peerConnection['id'];
    switch (description['type']) {
      case 'create-offer':
        if (!this._has(id)) {
          if (!this._configurationIsSet) {
            return this._pendingCreateOffers.add(id);
          }
          this._create(id);
        }
        return this._createOffer(id);

      case 'offer':
        if (!this._has(id)) {
          if (!this._configurationIsSet) {
            return this._pendingRemoteOffers.set(id, description);
          }
          this._create(id);
        }
        return this._setRemoteDescription(id, description);

      case 'answer':
        return this._setRemoteDescription(id, description);

      case 'close':
        return this._close(id);
    }
  }, this)).then(function syncTracks() {
    self._updateRemoteTracks(self._peerConnections);
  });
};

/**
 * @event {PeerConnectionManager#conversationInfo}
 * @param {object} conversationInfo
 */

module.exports = PeerConnectionManager;
