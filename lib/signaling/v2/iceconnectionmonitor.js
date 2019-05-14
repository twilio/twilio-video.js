'use strict';

const { ICE_ACTIVITY_CHECK_PERIOD_MS, ICE_INACTIVITY_THRESHOLD_MS } = require('../../util/constants');
const { getStats } = require('@twilio/webrtc');

/**
 * Monitors a {@link RTCPeerConnection}'s media stats and notifies
 * caller when inactivity is detected.
 */
class IceConnectionMonitor {
  /**
   * Construct an {@link IceConnectionMonitor}.
   * @param {RTCPeerConnection} peerConnection
   * @param {object} [options]
   */
  constructor(peerConnection, options) {
    options = Object.assign({
      activityCheckPeriodMS: ICE_ACTIVITY_CHECK_PERIOD_MS,
      inactivityThresholdMS: ICE_INACTIVITY_THRESHOLD_MS,
    }, options);

    Object.defineProperties(this, {
      _peerConnection: {
        value: peerConnection
      },
      _timer: {
        value: null,
        writable: true,
      },
      _activityCheckPeriodMS: {
        value: options.activityCheckPeriodMS
      },
      _inactivityThresholdMS: {
        value: options.inactivityThresholdMS
      }
    });
  }

  // TODO: remove this before merging.
  _makarandlog() {
    var newArgs = ['makarand: '];
    var args = Array.prototype.slice.call(arguments);
    console.log.apply(console.log, newArgs.concat(args));
  }

  // TODO: simplify once timestamp is added to the webrtc getStat api.
  _getMediaStats() {
    // returns stats needed for media monotor.
    return getStats(this._peerConnection).then((response) => {
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
      return null;
    });
  }
  /**
   * Start monitoring.
   * @returns {void}
   */
  start(onInactiveCallback) {
    if (typeof onInactiveCallback !== 'function') throw new Error('invalid callback');

    this._makarandlog('starting MediaTimer');
    this.stop();
    this._timer = setInterval(() => {
      this._getMediaStats().then(mediaStats => {
        if (!mediaStats) {
          return;
        }

        if (this._lastActivity ) {
          this._makarandlog('Diff: ', {
            time: mediaStats.timestamp - this._lastActivity.timestamp,
            received: mediaStats.bytesReceived - this._lastActivity.bytesReceived,
            sent: mediaStats.bytesSent - this._lastActivity.bytesSent
          });
        }

        // if change detected in bytesReceived mark it as lastActiveiy.
        if (!this._lastActivity || this._lastActivity.bytesReceived !== mediaStats.bytesReceived) {
          this._lastActivity = mediaStats;
        }

        // after inactivity threshold fire inactiveCallback.
        if (mediaStats.timestamp - this._lastActivity.timestamp >= this._inactivityThresholdMS) {
          onInactiveCallback();
        }
      }).catch((err) => {
        this._makarandlog('error in _restartIceIfInactiveForLong', err);
      });
    }, this._activityCheckPeriodMS);
  }

  /**
   * Stop monitoring.
   * @returns {void}
   */
  stop() {
    if (this._timer !== null) {
      this._makarandlog('stopping MediaTimer');
      clearInterval(this._timer);
      this._timer = null;
    }
  }
}

module.exports = IceConnectionMonitor;
