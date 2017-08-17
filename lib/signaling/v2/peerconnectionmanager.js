'use strict';

var inherits = require('util').inherits;
var PeerConnectionV2 = require('./peerconnection');
var MediaStream = require('@twilio/webrtc').MediaStream;
var QueueingEventEmitter = require('../../queueingeventemitter');
var util = require('../../util');

// var isFirefox = util.guessBrowser() === 'firefox';

/**
 * Construct {@link PeerConnectionManager}.
 * @class
 * @classdesc {@link PeerConnectionManager} manages multiple
 * {@link PeerConnectionV2}s.
 * @extends {QueueingEventEmitter}
 * @param {IceServerSource} iceServerSource
 * @emits PeerConnectionManager#candidates
 * @emits PeerConnectionManager#description
 * @emits PeerConnectionManager#trackAdded
 */
function PeerConnectionManager(iceServerSource, options) {
  if (!(this instanceof PeerConnectionManager)) {
    return new PeerConnectionManager(options);
  }
  QueueingEventEmitter.call(this);

  options = Object.assign({
    // NOTE(mroberts): We're not quite ready to release the workaround for the
    // Firefox/Chrome BUNDLE issue, so we'll leave this disabled for now. In the
    // future, it should look something like
    //
    //   audioContextFactory: isFirefox
    //     ? require('../../webaudio/audiocontext')
    //     : null,
    //
    // We'll need to delay the require call since the singleton exported depends
    // on Set, which fails our UMD tests.
    audioContextFactory: null,
    MediaStream: MediaStream,
    PeerConnectionV2: PeerConnectionV2
  }, options);

  var audioContext = options.audioContextFactory
    ? options.audioContextFactory.getOrCreate(this)
    : null;

  // NOTE(mroberts): If we're using an AudioContext, we don't need to specify
  // `offerToReceiveAudio` in RTCOfferOptions.
  var offerOptions = audioContext
    ? { offerToReceiveVideo: true }
    : { offerToReceiveAudio: true, offerToReceiveVideo: true };

  Object.defineProperties(this, {
    _audioContextFactory: {
      value: options.audioContextFactory
    },
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
    _dummyAudioMediaStreamTrack: {
      value: audioContext
        ? createDummyAudioMediaStreamTrack(audioContext)
        : null
    },
    _iceServerSource: {
      value: iceServerSource
    },
    _localMediaStream: {
      value: new options.MediaStream()
    },
    _offerOptions: {
      value: offerOptions
    },
    _peerConnections: {
      value: new Map()
    },
    _PeerConnectionV2: {
      value: options.PeerConnectionV2
    }
  });

  if (this._dummyAudioMediaStreamTrack) {
    this._localMediaStream.addTrack(this._dummyAudioMediaStreamTrack);
  }
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

    var options = Object.assign({
      offerOptions: this._offerOptions
    }, configuration);
    peerConnection = new PeerConnectionV2(id, options);

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
    peerConnection.addMediaStream(this._localMediaStream);
  }
  return peerConnection;
};

/**
 * Close all the {@link PeerConnectionV2}s in this {@link PeerConnectionManager}.
 * @returns {this}
 */
PeerConnectionManager.prototype.close = function close() {
  if (this._iceServerSource.isStarted) {
    this._iceServerSource.stop();
  }
  this._peerConnections.forEach(function(peerConnection) {
    peerConnection.close();
  });
  if (this._dummyAudioMediaStreamTrack) {
    this._dummyAudioMediaStreamTrack.stop();
  }
  if (this._audioContextFactory) {
    this._audioContextFactory.release(this);
  }
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
 * Get the remote MediaStreamTracks of all the {@link PeerConnectionV2}s.
 * @returns {Array<MediaStreamTrack>}
 */
PeerConnectionManager.prototype.getRemoteMediaStreamTracks = function getRemoteMediaStreamTracks() {
  return util.flatMap(this._peerConnections, function(peerConnection) {
    return peerConnection.getRemoteMediaStreamTracks();
  });
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
 * Set the local MediaStreamTracks on the {@link PeerConnectionManager}'s underlying
 * {@link PeerConnectionV2}s.
 * @param {Array<MediaStreamTrack>} mediaStreamTracks
 * @returns {this}
 */
PeerConnectionManager.prototype.setMediaStreamTracks = function setMediaStreamTracks(mediaStreamTracks) {
  if (this._dummyAudioMediaStreamTrack) {
    mediaStreamTracks.push(this._dummyAudioMediaStreamTrack);
  }

  var tracksToRemove = util.difference(this._localMediaStream.getTracks(), mediaStreamTracks);
  var tracksToAdd = util.difference(mediaStreamTracks, this._localMediaStream.getTracks());

  if (tracksToRemove.size || tracksToAdd.size) {
    tracksToRemove.forEach(this._localMediaStream.removeTrack, this._localMediaStream);
    tracksToAdd.forEach(this._localMediaStream.addTrack, this._localMediaStream);

    this._peerConnections.forEach(function(peerConnection) {
      peerConnection.removeMediaStream(this._localMediaStream);
      peerConnection.addMediaStream(this._localMediaStream);
      peerConnection.offer();
    }, this);
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
 * Create a dummy audio MediaStreamTrack with the given AudioContext.
 * @private
 * @param {AudioContext} audioContext
 * @return {MediaStreamTrack}
 */
function createDummyAudioMediaStreamTrack(audioContext) {
  var mediaStreamDestination = audioContext.createMediaStreamDestination();
  return mediaStreamDestination.stream.getAudioTracks()[0];
}

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
