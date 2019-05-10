/* eslint callback-return:0 */
'use strict';

const EventEmitter = require('events');
const {getStats} = require('@twilio/webrtc');


const PeerConnectionReportFactory = require('../../stats/peerconnectionreportfactory');

/**
 * @emits IceMediaMonitor#updated
 */
class IceMediaMonitor extends EventEmitter {
  /**
   * Construct a {@link IceMediaMonitor}.
   * @param {PeerConnectionV2} pc
   */
  constructor(pc) {
    super();
    Object.defineProperties(this, {
      _pc: {
        value: pc
      },
      _lastIceState: {
        value: null
      }
    });
    pc.on('iceConnectionStateChanged', () => {
      // TODO, can pc emit iceConnectionState, along with this event?
      this._lastIceState = pc.iceConnectionState;
    });
  }

  _getMediaStats() {
    // returns stats needed for media monotor.
    return getStats(this._pc).then(response => {
      // TODO: update twilio-webRTC to contain timestamp in activeIceCandidatePair
      if (response.activeIceCandidatePair) {
        return this._peerConnection.getStats().then((stats) => {
          var realActiveCandidatePairStats = Array.from(stats.values()).find(function(stat) {
            return stat.type === 'candidate-pair' && stat.nominated;
          });
          return {
            timestamp: realActiveCandidatePairStats.timestamp,
            bytesReceived: response.activeIceCandidatePair.bytesReceived,
            bytesSent: response.activeIceCandidatePair.bytesSent
          };
        });
      }
    });
  }

  _restartIceIfInactiveForLong() {
    const kInactivityThresholdMs = 3000; // ms
    this._getMediaStats().then(mediaStats => {
      this._makarandlog('mediaStats: ', mediaStats);
      if (!this._lastActivity ||
          this._lastActivity.bytesReceived !== mediaStats.bytesReceived ||
          this._lastActivity.bytesSent !== mediaStats.bytesSent) {
        this._lastActivity = mediaStats;
      }
      if (mediaStats.timestamp - this._lastActivity.timestamp > kInactivityThresholdMs) {
        this.emit('oninactive');
      }
    }).catch((err) => {
      this._makarandlog('error in _restartIceIfInactiveForLong', err);
      throw new MediaClientLocalDescFailedError();
    });
  }

  _makarandlog() {
    var newArgs = ['makarand: [' + this._lastIceState + ']:'];
    var args = Array.prototype.slice.call(arguments);
    console.log.apply(console.log, newArgs.concat(args));
  }
  /**
   * Start monitoring.
   * @returns {void}
   */
  start() {
    const kActivityCheckPeriod = 10000; // ms

    this.stop();
    const timeout = setTimeout(() => {
      if (this._timeout !== timeout) {
        return;
      }
    }, kActivityCheckPeriod);
    this._timeout = timeout;
  }

  /**
   * Stop monitoring.
   * @returns {void}
   */
  stop() {
    clearTimeout(this._timeout);
    this._timeout = null;
  }
}

module.exports = IceMediaMonitor;
