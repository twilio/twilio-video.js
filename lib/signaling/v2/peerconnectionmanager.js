'use strict';

var inherits = require('util').inherits;
var PeerConnectionV2 = require('./peerconnection');
var MediaStream = require('@twilio/webrtc').MediaStream;
var QueueingEventEmitter = require('../../queueingeventemitter');
var util = require('../../util');

var isFirefox = util.guessBrowser() === 'firefox';

/**
 * Construct {@link PeerConnectionManager}.
 * @class
 * @classdesc {@link PeerConnectionManager} manages multiple
 * {@link PeerConnectionV2}s.
 * @extends {QueueingEventEmitter}
 * @param {IceServerSource} iceServerSource
 * @param {EncodingParametersImpl} encodingParameters
 * @param {PreferredCodecs} preferredCodecs
 * @emits PeerConnectionManager#candidates
 * @emits PeerConnectionManager#description
 * @emits PeerConnectionManager#trackAdded
 */
function PeerConnectionManager(iceServerSource, encodingParameters, preferredCodecs, options) {
  if (!(this instanceof PeerConnectionManager)) {
    return new PeerConnectionManager(iceServerSource, encodingParameters, preferredCodecs, options);
  }
  QueueingEventEmitter.call(this);

  options = Object.assign({
    audioContextFactory: isFirefox
      ? require('../../webaudio/audiocontext')
      : null,
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
    _encodingParameters: {
      value: encodingParameters
    },
    _iceServerSource: {
      value: iceServerSource
    },
    _dataTrackSenders: {
      writable: true,
      value: new Set()
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
    _preferredCodecs: {
      value: preferredCodecs
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
    peerConnection = new PeerConnectionV2(id, this._encodingParameters, this._preferredCodecs, options);

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
    this._dataTrackSenders.forEach(peerConnection.addDataTrackSender, peerConnection);
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
 * Get the remote MediaStreamTracks and {@link DataTrackReceiver}s of all
 * the {@link PeerConnectionV2}s.
 * @returns {Array<MediaStreamTrack|DataTrackReceiver>} mediaStreamTracksAndDataTrackReceivers
 */
PeerConnectionManager.prototype.getRemoteMediaStreamTracksAndDataTrackReceivers = function getRemoteMediaStreamTracksAndDataTrackReceivers() {
  return util.flatMap(this._peerConnections, function(peerConnection) {
    return peerConnection.getRemoteMediaStreamTracksAndDataTrackReceivers();
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
 * Set the local MediaStreamTracks and {@link DataTrackSender}s on the
 * {@link PeerConnectionManager}'s underlying {@link PeerConnectionV2}s.
 * @param {Array<MediaStreamTrack|DataTrackSender>} mediaStreamTracksAndDataTrackSenders
 * @returns {this}
 */
PeerConnectionManager.prototype.setMediaStreamTracksAndDataTrackSenders = function setMediaStreamTracksAndDataTrackSenders(mediaStreamTracksAndDataTrackSenders) {
  var mediaStreamTracks = new Set();
  var dataTrackSenders = new Set();
  mediaStreamTracksAndDataTrackSenders.forEach(function(mediaStreamTrackOrDataTrackSender) {
    if (mediaStreamTrackOrDataTrackSender.kind === 'data') {
      dataTrackSenders.add(mediaStreamTrackOrDataTrackSender);
    } else {
      mediaStreamTracks.add(mediaStreamTrackOrDataTrackSender);
    }
  });

  if (this._dummyAudioMediaStreamTrack) {
    mediaStreamTracks.add(this._dummyAudioMediaStreamTrack);
  }

  var changes = getMediaStreamTrackAndDataTrackSenderChanges(this, dataTrackSenders, mediaStreamTracks);

  this._dataTrackSenders = dataTrackSenders;

  applyMediaStreamTrackAndDataTrackSenderChanges(this, changes);

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
 * @param {MediaStreamTrack|DataTrackReceiver} mediaStreamTrackOrDataTrackReceiver
 */

/**
 * Apply {@link MediaStreamTrackAndDataTrackSenderChanges}.
 * @param {PeerConnectionManager} peerConnectionManager
 * @param {MediaStreamTrackAndDataTrackSenderChanges} changes
 * @returns {void}
 */
function applyMediaStreamTrackAndDataTrackSenderChanges(peerConnectionManager, changes) {
  if (changes.data.add.size
    || changes.data.remove.size
    || changes.media.add.size
    || changes.media.remove.size) {
    peerConnectionManager._peerConnections.forEach(function(peerConnection) {
      peerConnection.removeMediaStream(this._localMediaStream);
      changes.data.remove.forEach(peerConnection.removeDataTrackSender, peerConnection);
    }, peerConnectionManager);

    changes.media.remove.forEach(peerConnectionManager._localMediaStream.removeTrack, peerConnectionManager._localMediaStream);
    changes.media.add.forEach(peerConnectionManager._localMediaStream.addTrack, peerConnectionManager._localMediaStream);

    peerConnectionManager._peerConnections.forEach(function(peerConnection) {
      peerConnection.addMediaStream(this._localMediaStream);
      changes.data.add.forEach(peerConnection.addDataTrackSender, peerConnection);
      peerConnection.offer();
    }, peerConnectionManager);
  }
}

/**
 * @interface DataTrackSenderChanges
 * @property {Set<DataTrackSender>} add
 * @property {Set<DataTrackSender>} remove
 */

/**
 * Get {@Link DataTrackSender} changes.
 * @param {PeerConnectionManager} peerConnectionManager
 * @param {Array<DataTrackSender>} dataTrackSenders
 * @returns {DataTrackSenderChanges} changes
 */
function getDataTrackSenderChanges(peerConnectionManager, dataTrackSenders) {
  var dataTrackSendersToRemove = util.difference(peerConnectionManager._dataTrackSenders, dataTrackSenders);
  var dataTrackSendersToAdd = util.difference(dataTrackSenders, peerConnectionManager._dataTrackSenders);
  return {
    add: dataTrackSendersToAdd,
    remove: dataTrackSendersToRemove
  };
}

/**
 * @interface MediaStreamTrackAndDataTrackSenderChanges
 * @property {DataTrackSenderChanges} data
 * @property {MediaStreamTrackChanges} media
 */

/**
 * Get {@link DataTrackSender} and MediaStreamTrack changes.
 * @param {PeerConnectionManager} peerConnectionManager
 * @param {Array<DataTrackSender>} dataTrackSenders
 * @param {Array<MediaStreamTrack>} mediaStreamTracks
 * @returns {MediaStreamTrackAndDataTrackSenderChanges} changes
 */
function getMediaStreamTrackAndDataTrackSenderChanges(peerConnectionManager, dataTrackSenders, mediaStreamTracks) {
  return {
    data: getDataTrackSenderChanges(peerConnectionManager, dataTrackSenders),
    media: getMediaStreamTrackChanges(peerConnectionManager, mediaStreamTracks)
  };
}

/**
 * @interface MediaStreamTrackChanges
 * @property {Set<MediaStreamTrack>} add
 * @property {Set<MediaStreamTrack>} remove
 */

/**
 * Get MediaStreamTrack changes.
 * @param {PeerConnectionManager} peerConnectionManager
 * @param {Array<MediaStreamTrack>} mediaStreamTracks
 * @returns {MediaStreamTrackChanges} changes
 */
function getMediaStreamTrackChanges(peerConnectionManager, mediaStreamTracks) {
  var mediaStreamTracksToRemove = util.difference(peerConnectionManager._localMediaStream.getTracks(), mediaStreamTracks);
  var mediaStreamTracksToAdd = util.difference(mediaStreamTracks, peerConnectionManager._localMediaStream.getTracks());
  return {
    add: mediaStreamTracksToAdd,
    remove: mediaStreamTracksToRemove
  };
}

module.exports = PeerConnectionManager;
