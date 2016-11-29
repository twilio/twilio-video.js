'use strict';

var inherits = require('util').inherits;
var PeerConnectionV2 = require('./peerconnection');
var QueueingEventEmitter = require('../../queueingeventemitter');
var util = require('../../util');

/**
 * Construct {@link PeerConnectionManager}.
 * @class
 * @classdesc {@link PeerConnectionManager} manages multiple
 * {@link PeerConnectionV2}s.
 * @extends {QueueingEventEmitter}
 * @emits PeerConnectionManager#candidates
 * @emits PeerConnectionManager#description
 * @emits PeerConnectionManager#trackAdded
 */
function PeerConnectionManager(options) {
  if (!(this instanceof PeerConnectionManager)) {
    return new PeerConnectionManager(options);
  }
  QueueingEventEmitter.call(this);
  options = Object.assign({
    PeerConnectionV2: PeerConnectionV2
  }, options);
  Object.defineProperties(this, {
    _closedPeerConnectionIds: {
      value: new Set()
    },
    _configuration: {
      writable: true,
      value: null
    },
    _configurationDeferred: {
      writable: true,
      value: util.defer()
    },
    _localMediaStreams: {
      value: new Set()
    },
    _localMediaStreamTracks: {
      value: new Set()
    },
    _peerConnections: {
      value: new Map()
    },
    _PeerConnectionV2: {
      value: options.PeerConnectionV2
    }
  });
}

inherits(PeerConnectionManager, QueueingEventEmitter);

/**
 * Get the {@link PeerConnectionManager}'s configuration.
 * @returns {Promise<object>}
 */
PeerConnectionManager.prototype._getConfiguration = function _getConfiguration() {
  return this._configurationDeferred.promise;
};

/**
 * Get or create a {@link PeerConnectionV2}.
 * @param {string} id
 * @param {object} [configuration]
 * @returns {PeerConnectionV2}
 */
PeerConnectionManager.prototype._getOrCreate = function _getOrCreate(id, configuration) {
  var self = this;
  var peerConnection = this._peerConnections.get(id);
  if (!peerConnection) {
    var PeerConnectionV2 = this._PeerConnectionV2;
    peerConnection = new PeerConnectionV2(id, configuration);
    this._peerConnections.set(peerConnection.id, peerConnection);
    peerConnection.on('candidates', this.queue.bind(this, 'candidates'));
    peerConnection.on('description', this.queue.bind(this, 'description'));
    peerConnection.on('trackAdded', this.queue.bind(this, 'trackAdded'));
    peerConnection.on('stateChanged', function stateChanged(state) {
      if (state === 'closed') {
        peerConnection.removeListener('stateChanged', stateChanged);
        self._peerConnections.delete(peerConnection.id);
        self._closedPeerConnectionIds.add(peerConnection.id);
      }
    });
    this._localMediaStreams.forEach(peerConnection.addMediaStream, peerConnection);
  }
  return peerConnection;
};

/**
 * Add a local MediaStream to the {@link PeerConnectionManager}'s underlying
 * {@link PeerConnectionV2}s.
 * @param {MediaStream} mediaStream
 * @returns {this}
 */
PeerConnectionManager.prototype.addMediaStream = function addMediaStream(mediaStream) {
  this._localMediaStreams.add(mediaStream);
  mediaStream.getTracks().forEach(function(mediaStreamTrack) {
    this._localMediaStreamTracks.add(mediaStreamTrack);
  }, this);
  this._peerConnections.forEach(function(peerConnection) {
    peerConnection.addMediaStream(mediaStream);
  }, this);
  return this;
};

/**
 * Close all the {@link PeerConnectionV2}s in this {@link PeerConnectionManager}.
 * @returns {this}
 */
PeerConnectionManager.prototype.close = function close() {
  this._peerConnections.forEach(function(peerConnection) {
    peerConnection.close();
  });
  return this;
};

/**
 * Create a new {@link PeerConnectionV2} on this {@link PeerConnectionManager}.
 * Then, create a new offer with the newly-created {@link PeerConnectionV2}.
 * @return {Promise<this>}
 */
PeerConnectionManager.prototype.createAndOffer = function createAndOffer() {
  var self = this;
  return this._getConfiguration().then(function getConfigurationSucceeded(configuration) {
    var id;
    do {
      id = util.makeUUID();
    } while (self._peerConnections.has(id));

    return self._getOrCreate(id, configuration);
  }).then(function createSucceeded(peerConnection) {
    return peerConnection.offer();
  }).then(function offerSucceeded() {
    return self;
  });
};

/**
 * Get the remote MediaStreams of all the {@link PeerConnectionV2}s.
 * @returns {Array<MediaStream>}
 */
PeerConnectionManager.prototype.getRemoteMediaStreams = function getRemoteMediaStreams() {
  var remoteStreams = [];
  this._peerConnections.forEach(function(peerConnection) {
    remoteStreams = remoteStreams.concat(peerConnection.getRemoteMediaStreams());
  });
  return remoteStreams;
};

/**
 * Get the states of all {@link PeerConnectionV2}s.
 * @returns {Array<object>}
 */
PeerConnectionManager.prototype.getStates = function getStates() {
  var peerConnectionStates = [];
  this._peerConnections.forEach(function(peerConnection) {
    var peerConnectionState = peerConnection.getState();
    if (peerConnectionState) {
      peerConnectionStates.push(peerConnectionState);
    }
  });
  return peerConnectionStates;
};

/**
 * Remove a local MediaStream from the {@link PeerConnectionManager}'s underlying
 * {@link PeerConnectionV2}s.
 * @param {MediaStream} mediaStream
 * @returns {boolean}
 */
PeerConnectionManager.prototype.removeMediaStream = function removeMediaStream(mediaStream) {
  var result = this._localMediaStreams.delete(mediaStream);
  this._peerConnections.forEach(function(peerConnection) {
    peerConnection.removeMediaStream(mediaStream);
    mediaStream.getTracks().forEach(function(mediaStreamTrack) {
      this._localMediaStreamTracks.delete(mediaStreamTrack);
    }, this);
  }, this);
  return result;
};

/**
 * Set the {@link PeerConnectionManager}'s configuration.
 * @param {object} configuration
 * @returns {this}
 */
PeerConnectionManager.prototype.setConfiguration = function setConfiguration(configuration) {
  if (this._configuration) {
    this._configurationDeferred = util.defer();
    this._peerConnections.forEach(function(peerConnection) {
      peerConnection.setConfiguration(configuration);
    });
  }
  this._configuration = configuration;
  this._configurationDeferred.resolve(configuration);
  return this;
};

/**
 * Set the local MediaStreams on the {@link PeerConnectionManager}'s underlying
 * {@link PeerConnectionV2}s.
 * @param {Array<MediaStream>} mediaStreams
 * @returns {this}
 */
PeerConnectionManager.prototype.setMediaStreams = function setMediaStreams(mediaStreams) {
  var mediaStreamTracksBefore = new Set(this._localMediaStreamTracks.values());
  this._localMediaStreamTracks.clear();

  this._localMediaStreams.forEach(this.removeMediaStream, this);
  mediaStreams.forEach(this.addMediaStream, this);
  var mediaStreamTracksAfter = this._localMediaStreamTracks;

  var mediaStreamTracksChanged = false;
  if (mediaStreamTracksBefore.size !== mediaStreamTracksAfter.size) {
    mediaStreamTracksChanged = true;
  } else {
    mediaStreamTracksBefore.forEach(function(mediaStreamTrack) {
      if (!mediaStreamTracksAfter.has(mediaStreamTrack)) {
        mediaStreamTracksChanged = true;
      }
    });
  }

  if (mediaStreamTracksChanged) {
    this._peerConnections.forEach(function(peerConnection) {
      peerConnection.offer();
    });
  }

  return this;
};

/**
 * Update the {@link PeerConnectionManager}.
 * @param {Array<object>} peerConnectionStates
 * @returns {Promise<this>}
 */
PeerConnectionManager.prototype.update = function update(peerConnectionStates) {
  var self = this;
  return this._getConfiguration().then(function getConfigurationSucceeded(configuration) {
    return Promise.all(peerConnectionStates.map(function(peerConnectionState) {
      if (self._closedPeerConnectionIds.has(peerConnectionState.id)) {
        return null;
      }
      var peerConnection = self._getOrCreate(peerConnectionState.id, configuration);
      return peerConnection.update(peerConnectionState);
    }));
  }).then(function updatesSucceeded() {
    return self;
  });
};

/**
 * Get the {@link PeerConnectionManager}'s media statistics.
 * @returns {Promise.<Array<StatsReport>>}
 */
PeerConnectionManager.prototype.getStats = function getStats() {
  var peerConnections = Array.from(this._peerConnections.values());
  return Promise.all(peerConnections.map(function(peerConnection) {
    return peerConnection.getStats();
  }));
};

/**
 * @event {PeerConnectionManager#candidates}
 * @param {object} candidates
 */

/**
 * @event {PeerConnectionManager#description}
 * @param {object} description
 */

/**
 * @event {PeerConnectionManager#trackAdded}
 * @param {MediaStreamTrack} mediaStreamTrack
 * @param {MediaStream} mediaStream
 */

module.exports = PeerConnectionManager;
