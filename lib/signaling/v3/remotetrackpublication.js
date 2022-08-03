'use strict';

const RemoteTrackPublicationSignaling = require('../remotetrackpublication');

/**
 * @extends RemoteTrackPublicationSignaling
 */
class RemoteTrackPublicationV3 extends RemoteTrackPublicationSignaling {
  /**
   * Construct a {@link RemoteTrackPublicationV3}.
   * @param {RemoteTrackPublicationV3#Representation} track
   * @param {boolean} isSwitchedOff
   * @param {?string} switchOffReason
   * @param {function(MediaStreamTrack): Promise<Map<PeerConnectionV2#id, StandardizedTrackStatsReport>>} getTrackStats
   */
  constructor(track, isSwitchedOff, switchOffReason, getTrackStats) {
    switchOffReason = isSwitchedOff ? switchOffReason : null;
    const enabled = isEnabled(isSwitchedOff, switchOffReason);
    const { kind, name, priority, sid } = track;

    super(
      sid,
      name,
      kind,
      enabled,
      priority,
      isSwitchedOff,
      3
    );

    Object.defineProperties(this, {
      _getTrackStats: {
        value: getTrackStats
      },
      _isSubscribed: {
        value: false,
        writable: true
      },
      _switchOffReason: {
        value: switchOffReason,
        writable: true
      },
      _switchOnMediaStreamTrackStats: {
        value: initialTrackStats(sid, kind),
        writable: true
      },
      _switchOnStats: {
        value: initialTrackStats(sid, kind),
        writable: true
      }
    });
  }

  /**
   * Whether the {@link RemoteTrackPublicationV3} is subscribed to.
   * @property {boolean}
   */
  get isSubscribed() {
    return this._isSubscribed;
  }

  /**
   * The reason for the {@link RemoteTrackPublicationV3} being switched off.
   * @returns {?string}
   */
  get switchOffReason() {
    return this._switchOffReason;
  }

  /**
   * Adjust Track statistics based on new stats. Returns the most
   * recent switched on Track statistics if no argument is provided.
   * @param {StandardizedTrackStatsReport} [newMediaStreamTrackStats]
   * @returns {StandardizedTrackStatsReport}
   */
  adjustTrackStats(newMediaStreamTrackStats = {}) {
    const cumStatsProps = [
      'bytesReceived',
      'framesDecoded',
      'packetsLost',
      'packetsReceived',
      'totalDecodeTime'
    ];
    const snapshotStatsProps = [
      'audioOutputLevel',
      'codecName',
      'estimatedPlayoutTimestamp',
      'frameHeightReceived',
      'frameRateReceived',
      'framesDecoded',
      'frameWidthReceived',
      'jitter',
      'jitterBufferDelay',
      'jitterBufferEmittedCount',
      'roundTripTime',
      'ssrc',
      'timestamp',
      'trackId'
    ];
    const trackStats = Object.assign({}, this._switchOnStats);

    cumStatsProps.forEach(prop => {
      if (prop in newMediaStreamTrackStats) {
        trackStats[prop] = this._switchOnStats[prop] + newMediaStreamTrackStats[prop] - this._switchOnMediaStreamTrackStats[prop];
      }
    });

    snapshotStatsProps.forEach(prop => {
      if (prop in newMediaStreamTrackStats) {
        trackStats[prop] = newMediaStreamTrackStats[prop];
      }
    });

    return trackStats;
  }

  /**
   * Updates track switch on/off state.
   * @param {boolean} isSwitchedOff
   * @param {?string} switchOffReason
   * @returns {this}
   */
  setSwitchedOff(isSwitchedOff, switchOffReason) {
    switchOffReason = isSwitchedOff ? switchOffReason : null;
    const shouldEmitUpdated = isSwitchedOff !== this.isSwitchedOff
      || switchOffReason !== this.switchOffReason;
    this._isSwitchedOff = isSwitchedOff;
    this._switchOffReason = switchOffReason;
    if (shouldEmitUpdated) {
      this.emit('updated');
    }
    return this.enable(isEnabled(isSwitchedOff, switchOffReason));
  }

  /**
   * Set the {@link MediaTrackReceiver} on the {@link RemoteTrackPublicationV3}.
   * @override
   * @param {MediaTrackReceiver} trackReceiver
   * @param {boolean} isSubscribed
   * @returns {this}
   */
  setTrackTransceiver(trackReceiver, isSubscribed) {
    isSubscribed = !!trackReceiver || isSubscribed;
    const shouldEmitUpdated = trackReceiver !== this.trackTransceiver || isSubscribed !== this.isSubscribed;

    if (this.kind !== 'data' && trackReceiver !== this.trackTransceiver) {
      this._getTrackStats((trackReceiver || this._trackTransceiver).track).then(report => {
        // NOTE(mmalavalli): Because RSPv3 is associated with Large Rooms only, the statistics
        // map will contain an entry associated with only one RTCPeerConnection.
        const mediaStreamTrackStats = report.values().next().value;
        if (trackReceiver) {
          this._switchOnMediaStreamTrackStats = mediaStreamTrackStats;
        }
        this._switchOnStats = this.adjustTrackStats(mediaStreamTrackStats);
      });
    }

    this._trackTransceiver = trackReceiver;
    this._isSubscribed = isSubscribed;
    if (shouldEmitUpdated) {
      this.emit('updated');
    }
    return this;
  }

  /**
   * Compare the {@link RemoteTrackPublicationV3} to a
   * {@link RemoteTrackPublicationV3#Representation} of itself and perform any
   * updates necessary.
   * @param {RemoteTrackPublicationV3#Representation} track
   * @returns {this}
   * @fires TrackSignaling#updated
   */
  update(track) {
    this.setPriority(track.priority);
    return this;
  }
}

/**
 * @private
 * @param {boolean} isSwitchedOff
 * @param {?string} switchOffReason
 * @returns {boolean}
 */
function isEnabled(isSwitchedOff, switchOffReason) {
  return !(isSwitchedOff && switchOffReason === 'DISABLED_BY_PUBLISHER');
}

/**
 * @private
 * @param {Track.SID} sid
 * @param {Track.Kind} kind
 * @returns {StandardizedTrackStatsReport}
 */
function initialTrackStats(sid, kind) {
  return Object.assign({
    bytesReceived: 0,
    codecName: '',
    estimatedPlayoutTimestamp: 0,
    jitter: 0,
    jitterBufferDelay: 0,
    jitterBufferEmittedCount: 0,
    packetsLost: 0,
    packetsReceived: 0,
    roundTripTime: 0,
    ssrc: '',
    timestamp: 0,
    trackId: '',
    trackSid: sid
  }, {
    audio: {
      audioOutputLevel: 0
    },
    data: {},
    video: {
      frameHeightReceived: 0,
      frameRateReceived: 0,
      framesDecoded: 0,
      frameWidthReceived: 0,
      totalDecodeTime: 0
    }
  }[kind]);
}

/**
 * The Room Signaling Protocol (RSP) representation of a {@link RemoteTrackPublicationV3}.
 * @typedef {object} RemoteTrackPublicationV3#Representation
 * @property {Track.Kind} kind
 * @property {string} name
 * @priority {Track.Priority} priority
 * @property {Track.SID} sid
 */

module.exports = RemoteTrackPublicationV3;
