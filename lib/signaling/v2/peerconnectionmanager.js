'use strict';

const { guessBrowser } = require('@twilio/webrtc/lib/util');
const PeerConnectionV2 = require('./peerconnection');
const MediaTrackSender = require('../../media/track/sender');
const QueueingEventEmitter = require('../../queueingeventemitter');
const util = require('../../util');
const { MediaConnectionError } = require('../../util/twilio-video-errors');

const isFirefox = guessBrowser() === 'firefox';

/**
 * {@link PeerConnectionManager} manages multiple {@link PeerConnectionV2}s.
 * @extends QueueingEventEmitter
 * @emits PeerConnectionManager#candidates
 * @emits PeerConnectionManager#connectionStateChanged
 * @emits PeerConnectionManager#description
 * @emits PeerConnectionManager#iceConnectionStateChanged
 * @emits PeerConnectionManager#trackAdded
 */
class PeerConnectionManager extends QueueingEventEmitter {
  /**
   * Construct {@link PeerConnectionManager}.
   * @param {EncodingParametersImpl} encodingParameters
   * @param {PreferredCodecs} preferredCodecs
   * @param {object} options
   */
  constructor(encodingParameters, preferredCodecs, options) {
    super();

    options = Object.assign({
      audioContextFactory: isFirefox
        ? require('../../webaudio/audiocontext')
        : null,
      PeerConnectionV2
    }, options);

    const audioContext = options.audioContextFactory
      ? options.audioContextFactory.getOrCreate(this)
      : null;

    // NOTE(mroberts): If we're using an AudioContext, we don't need to specify
    // `offerToReceiveAudio` in RTCOfferOptions.
    const offerOptions = audioContext
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
      _connectionState: {
        value: 'new',
        writable: true
      },
      _dummyAudioTrackSender: {
        value: audioContext
          ? new MediaTrackSender(createDummyAudioMediaStreamTrack(audioContext))
          : null
      },
      _encodingParameters: {
        value: encodingParameters
      },
      _iceConnectionState: {
        writable: true,
        value: 'new'
      },
      _dataTrackSenders: {
        writable: true,
        value: new Set()
      },
      _lastConnectionState: {
        value: 'new',
        writable: true
      },
      _lastIceConnectionState: {
        writable: true,
        value: 'new'
      },
      _mediaTrackSenders: {
        writable: true,
        value: new Set()
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
      _sessionTimeout: {
        value: null,
        writable: true
      },
      _PeerConnectionV2: {
        value: options.PeerConnectionV2
      }
    });
  }

  /**
   * A summarized RTCPeerConnectionState across all the
   * {@link PeerConnectionManager}'s underlying {@link PeerConnectionV2}s.
   * @property {RTCPeerConnectionState}
   */
  get connectionState() {
    return this._connectionState;
  }

  /**
   * A summarized RTCIceConnectionState across all the
   * {@link PeerConnectionManager}'s underlying {@link PeerConnectionV2}s.
   * @property {RTCIceConnectionState}
   */
  get iceConnectionState() {
    return this._iceConnectionState;
  }

  /**
   * Close the {@link PeerConnectionV2}s which are no longer relevant.
   * @param {Array<object>} peerConnectionStates
   * @returns {this}
   */
  _closeAbsentPeerConnections(peerConnectionStates) {
    const peerConnectionIds = new Set(peerConnectionStates.map(peerConnectionState => peerConnectionState.id));
    this._peerConnections.forEach(peerConnection => {
      if (!peerConnectionIds.has(peerConnection.id)) {
        peerConnection._close();
      }
    });
    return this;
  }

  /**
   * Get the {@link PeerConnectionManager}'s configuration.
   * @private
   * @returns {Promise<object>}
   */
  _getConfiguration() {
    return this._configurationDeferred.promise;
  }

  /**
   * Get or create a {@link PeerConnectionV2}.
   * @private
   * @param {string} id
   * @param {object} [configuration]
   * @returns {PeerConnectionV2}
   */
  _getOrCreate(id, configuration) {
    const self = this;
    let peerConnection = this._peerConnections.get(id);
    if (!peerConnection) {
      const PeerConnectionV2 = this._PeerConnectionV2;

      const options = Object.assign({
        dummyAudioMediaStreamTrack: this._dummyAudioTrackSender
          ? this._dummyAudioTrackSender.track
          : null,
        offerOptions: this._offerOptions
      }, this._sessionTimeout ? {
        sessionTimeout: this._sessionTimeout
      } : {}, configuration);

      try {
        peerConnection = new PeerConnectionV2(id, this._encodingParameters, this._preferredCodecs, options);
      } catch (e) {
        throw new MediaConnectionError();
      }

      this._peerConnections.set(peerConnection.id, peerConnection);
      peerConnection.on('candidates', this.queue.bind(this, 'candidates'));
      peerConnection.on('description', this.queue.bind(this, 'description'));
      peerConnection.on('trackAdded', this.queue.bind(this, 'trackAdded'));
      peerConnection.on('stateChanged', function stateChanged(state) {
        if (state === 'closed') {
          peerConnection.removeListener('stateChanged', stateChanged);
          self._peerConnections.delete(peerConnection.id);
          self._closedPeerConnectionIds.add(peerConnection.id);
          updateConnectionState(self);
          updateIceConnectionState(self);
        }
      });
      peerConnection.on('connectionStateChanged', () => updateConnectionState(this));
      peerConnection.on('iceConnectionStateChanged', () => updateIceConnectionState(this));

      this._dataTrackSenders.forEach(peerConnection.addDataTrackSender, peerConnection);
      this._mediaTrackSenders.forEach(peerConnection.addMediaTrackSender, peerConnection);

      updateIceConnectionState(this);
    }
    return peerConnection;
  }

  /**
   * Close all the {@link PeerConnectionV2}s in this {@link PeerConnectionManager}.
   * @returns {this}
   */
  close() {
    this._peerConnections.forEach(peerConnection => {
      peerConnection.close();
    });
    if (this._dummyAudioTrackSender) {
      this._dummyAudioTrackSender.stop();
    }
    if (this._audioContextFactory) {
      this._audioContextFactory.release(this);
    }
    updateIceConnectionState(this);
    return this;
  }

  /**
   * Create a new {@link PeerConnectionV2} on this {@link PeerConnectionManager}.
   * Then, create a new offer with the newly-created {@link PeerConnectionV2}.
   * @return {Promise<this>}
   */
  createAndOffer() {
    return this._getConfiguration().then(configuration => {
      let id;
      do {
        id = util.makeUUID();
      } while (this._peerConnections.has(id));

      return this._getOrCreate(id, configuration);
    }).then(peerConnection => {
      return peerConnection.offer();
    }).then(() => {
      return this;
    });
  }

  /**
   * Get the {@link DataTrackReceiver}s and {@link MediaTrackReceiver}s of all
   * the {@link PeerConnectionV2}s.
   * @returns {Array<DataTrackReceiver|MediaTrackReceiver>} trackReceivers
   */
  getTrackReceivers() {
    return util.flatMap(this._peerConnections, peerConnection => peerConnection.getTrackReceivers());
  }

  /**
   * Get the states of all {@link PeerConnectionV2}s.
   * @returns {Array<object>}
   */
  getStates() {
    const peerConnectionStates = [];
    this._peerConnections.forEach(peerConnection => {
      const peerConnectionState = peerConnection.getState();
      if (peerConnectionState) {
        peerConnectionStates.push(peerConnectionState);
      }
    });
    return peerConnectionStates;
  }

  /**
   * Set the {@link PeerConnectionManager}'s configuration.
   * @param {object} configuration
   * @returns {this}
   */
  setConfiguration(configuration) {
    if (this._configuration) {
      this._configurationDeferred = util.defer();
      this._peerConnections.forEach(peerConnection => {
        peerConnection.setConfiguration(configuration);
      });
    }
    this._configuration = configuration;
    this._configurationDeferred.resolve(configuration);
    return this;
  }

  /**
   * Set the ICE reconnect timeout period for all {@link PeerConnectionV2}s.
   * @param {number} period - Period in milliseconds.
   * @returns {this}
   */
  setIceReconnectTimeout(period) {
    if (this._sessionTimeout === null) {
      this._peerConnections.forEach(peerConnection => {
        peerConnection.setIceReconnectTimeout(period);
      });
      this._sessionTimeout = period;
    }
    return this;
  }

  /**
   * Set the {@link DataTrackSender}s and {@link MediaTrackSender}s on the
   * {@link PeerConnectionManager}'s underlying {@link PeerConnectionV2}s.
   * @param {Array<DataTrackSender|MediaTrackSender>} trackSenders
   * @returns {this}
   */
  setTrackSenders(trackSenders) {
    const dataTrackSenders = new Set(trackSenders.filter(trackSender => trackSender.kind === 'data'));

    const mediaTrackSenders = new Set(trackSenders
      .filter(trackSender => trackSender && (trackSender.kind === 'audio' || trackSender.kind === 'video')));

    const changes = getTrackSenderChanges(this, dataTrackSenders, mediaTrackSenders);
    this._dataTrackSenders = dataTrackSenders;
    this._mediaTrackSenders = mediaTrackSenders;
    applyTrackSenderChanges(this, changes);

    return this;
  }

  /**
   * Update the {@link PeerConnectionManager}.
   * @param {Array<object>} peerConnectionStates
   * @param {boolean} [synced=false]
   * @returns {Promise<this>}
   */
  update(peerConnectionStates, synced = false) {
    if (synced) {
      this._closeAbsentPeerConnections(peerConnectionStates);
    }
    return this._getConfiguration().then(configuration => {
      return Promise.all(peerConnectionStates.map(peerConnectionState => {
        if (this._closedPeerConnectionIds.has(peerConnectionState.id)) {
          return null;
        }
        const peerConnection = this._getOrCreate(peerConnectionState.id, configuration);
        return peerConnection.update(peerConnectionState);
      }));
    }).then(() => {
      return this;
    });
  }

  /**
   * Get the {@link PeerConnectionManager}'s media statistics.
   * @returns {Promise.<Map<PeerConnectionV2#id, StandardizedStatsResponse>>}
   */
  getStats() {
    const peerConnections = Array.from(this._peerConnections.values());
    return Promise.all(peerConnections.map(peerConnection => peerConnection.getStats().then(response => [
      peerConnection.id,
      response
    ]))).then(responses => new Map(responses));
  }
}

/**
 * Create a dummy audio MediaStreamTrack with the given AudioContext.
 * @private
 * @param {AudioContext} audioContext
 * @return {MediaStreamTrack}
 */
function createDummyAudioMediaStreamTrack(audioContext) {
  const mediaStreamDestination = audioContext.createMediaStreamDestination();
  return mediaStreamDestination.stream.getAudioTracks()[0];
}

/**
 * @event {PeerConnectionManager#candidates}
 * @param {object} candidates
 */

/**
 * @event {PeerConnectionManager#connectionStateChanged}
 */

/**
 * @event {PeerConnectionManager#description}
 * @param {object} description
 */

/**
 * @event {PeerConnectionManager#iceConnectionStateChanged}
 */

/**
 * @event {PeerConnectionManager#trackAdded}
 * @param {MediaStreamTrack|DataTrackReceiver} mediaStreamTrackOrDataTrackReceiver
 */

/**
 * Apply {@link TrackSenderChanges}.
 * @param {PeerConnectionManager} peerConnectionManager
 * @param {TrackSenderChanges} changes
 * @returns {void}
 */
function applyTrackSenderChanges(peerConnectionManager, changes) {
  if (changes.data.add.size
    || changes.data.remove.size
    || changes.media.add.size
    || changes.media.remove.size) {
    peerConnectionManager._peerConnections.forEach(peerConnection => {
      changes.data.remove.forEach(peerConnection.removeDataTrackSender, peerConnection);
      changes.media.remove.forEach(peerConnection.removeMediaTrackSender, peerConnection);
      changes.data.add.forEach(peerConnection.addDataTrackSender, peerConnection);
      changes.media.add.forEach(peerConnection.addMediaTrackSender, peerConnection);
      if (changes.media.add.size
        || changes.media.remove.size
        || (changes.data.add.size && !peerConnection.isApplicationSectionNegotiated)) {
        peerConnection.offer();
      }
    });
  }
}

/**
 * @interface DataTrackSenderChanges
 * @property {Set<DataTrackSender>} add
 * @property {Set<DataTrackSender>} remove
 */

/**
 * Get the {@Link DataTrackSender} changes.
 * @param {PeerConnectionManager} peerConnectionManager
 * @param {Array<DataTrackSender>} dataTrackSenders
 * @returns {DataTrackSenderChanges} changes
 */
function getDataTrackSenderChanges(peerConnectionManager, dataTrackSenders) {
  const dataTrackSendersToAdd = util.difference(dataTrackSenders, peerConnectionManager._dataTrackSenders);
  const dataTrackSendersToRemove = util.difference(peerConnectionManager._dataTrackSenders, dataTrackSenders);
  return {
    add: dataTrackSendersToAdd,
    remove: dataTrackSendersToRemove
  };
}

/**
 * @interface TrackSenderChanges
 * @property {DataTrackSenderChanges} data
 * @property {MediaTrackSenderChanges} media
 */

/**
 * Get {@link DataTrackSender} and {@link MediaTrackSender} changes.
 * @param {PeerConnectionManager} peerConnectionManager
 * @param {Array<DataTrackSender>} dataTrackSenders
 * @param {Array<MediaTrackSender>} mediaTrackSenders
 * @returns {TrackSenderChanges} changes
 */
function getTrackSenderChanges(peerConnectionManager, dataTrackSenders, mediaTrackSenders) {
  return {
    data: getDataTrackSenderChanges(peerConnectionManager, dataTrackSenders),
    media: getMediaTrackSenderChanges(peerConnectionManager, mediaTrackSenders)
  };
}

/**
 * @interface MediaTrackSenderChanges
 * @property {Set<MediaTrackSender>} add
 * @property {Set<MediaTrackSender>} remove
 */

/**
 * Get the {@link MediaTrackSender} changes.
 * @param {PeerConnectionManager} peerConnectionManager
 * @param {Array<MediaTrackSender>} mediaTrackSenders
 * @returns {MediaTrackSenderChanges} changes
 */
function getMediaTrackSenderChanges(peerConnectionManager, mediaTrackSenders) {
  const mediaTrackSendersToAdd = util.difference(mediaTrackSenders, peerConnectionManager._mediaTrackSenders);
  const mediaTrackSendersToRemove = util.difference(peerConnectionManager._mediaTrackSenders, mediaTrackSenders);
  return {
    add: mediaTrackSendersToAdd,
    remove: mediaTrackSendersToRemove
  };
}

/**
 * This object maps RTCIceConnectionState and RTCPeerConnectionState values to a "rank".
 */
const toRank = {
  new: 0,
  checking: 1,
  connecting: 2,
  connected: 3,
  completed: 4,
  disconnected: -1,
  failed: -2,
  closed: -3
};

/**
 * This object maps "rank" back to RTCIceConnectionState or RTCPeerConnectionState values.
 */
let fromRank;

/**
 * `Object.keys` is not supported in older browsers, so we can't just
 * synchronously call it in this module; we need to defer invoking it until we
 * know we're in a modern environment (i.e., anything that supports WebRTC).
 * @returns {object} fromRank
 */
function createFromRank() {
  return Object.keys(toRank).reduce((fromRank, state) => {
    return Object.assign(fromRank, { [toRank[state]]: state });
  }, {});
}

/**
 * Summarize RTCIceConnectionStates or RTCPeerConnectionStates.
 * @param {Array<RTCIceConnectionState>|Array<RTCPeerConnectionState>} states
 * @returns {RTCIceConnectionState|RTCPeerConnectionState} summary
 */
function summarizeIceOrPeerConnectionStates(states) {
  if (!states.length) {
    return 'new';
  }
  fromRank = fromRank || createFromRank();
  return states.reduce((state1, state2) => {
    return fromRank[Math.max(toRank[state1], toRank[state2])];
  });
}

/**
 * Update the {@link PeerConnectionManager}'s `iceConnectionState`, and emit an
 * "iceConnectionStateChanged" event, if necessary.
 * @param {PeerConnectionManager} pcm
 * @returns {void}
 */
function updateIceConnectionState(pcm) {
  pcm._lastIceConnectionState = pcm.iceConnectionState;
  pcm._iceConnectionState = summarizeIceOrPeerConnectionStates(
    [...pcm._peerConnections.values()].map(pcv2 => pcv2.iceConnectionState));
  if (pcm.iceConnectionState !== pcm._lastIceConnectionState) {
    pcm.emit('iceConnectionStateChanged');
  }
}

/**
 * Update the {@link PeerConnectionManager}'s `connectionState`, and emit a
 * "connectionStateChanged" event, if necessary.
 * @param {PeerConnectionManager} pcm
 * @returns {void}
 */
function updateConnectionState(pcm) {
  pcm._lastConnectionState = pcm.connectionState;
  pcm._connectionState = summarizeIceOrPeerConnectionStates(
    [...pcm._peerConnections.values()].map(pcv2 => pcv2.connectionState));
  if (pcm.connectionState !== pcm._lastConnectionState) {
    pcm.emit('connectionStateChanged');
  }
}

module.exports = PeerConnectionManager;
