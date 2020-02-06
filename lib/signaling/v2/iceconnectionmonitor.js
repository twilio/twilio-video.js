'use strict';

const { ICE_ACTIVITY_CHECK_PERIOD_MS, ICE_INACTIVITY_THRESHOLD_MS } = require('../../util/constants');

/**
 * Monitors a {@link RTCPeerConnection}'s stats and notifies
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
      activityCheckPeriodMs: ICE_ACTIVITY_CHECK_PERIOD_MS,
      inactivityThresholdMs: ICE_INACTIVITY_THRESHOLD_MS,
    }, options);

    Object.defineProperties(this, {
      _activityCheckPeriodMs: {
        value: options.activityCheckPeriodMs
      },
      _inactivityThresholdMs: {
        value: options.inactivityThresholdMs
      },
      _lastActiveStats: {
        value: null,
        writable: true
      },
      _peerConnection: {
        value: peerConnection
      },
      _timer: {
        value: null,
        writable: true,
      }
    });
  }

  /**
   * Get ICE connection stats, and extract received and send bytes.
   * @returns Promise<?RTCIceCandidatePairStats>
   */
  _getIceConnectionStats() {
    return this._peerConnection.getStats().then(stats => Array.from(stats.values()).find(stat => {
      return stat.type === 'candidate-pair' && stat.nominated;
    })).then(activePairStat => {
      // NOTE(mpatwardhan): sometimes (JSDK-2667) after getting disconnected while switching network
      // we may not find active pair. Treat this as 0 bytesReceived so that we count it towards inactivity.
      return activePairStat || {
        bytesReceived: 0,
        timestamp: Math.round((new Date()).getTime())
      };
    }).catch(() => {
      return null;
    });
  }

  /**
   * Start monitoring the ICE connection.
   * Monitors bytes received on active ice connection pair,
   * invokes onIceConnectionInactive when inactivity is detected.
   * @param {function} onIceConnectionInactive
   */
  start(onIceConnectionInactive) {
    this.stop();
    this._timer = setInterval(() => {
      this._getIceConnectionStats().then(iceStats => {
        if (!iceStats) {
          return;
        }

        if (!this._lastActivity || this._lastActivity.bytesReceived !== iceStats.bytesReceived) {
          this._lastActivity = iceStats;
        }

        if (iceStats.timestamp - this._lastActivity.timestamp >= this._inactivityThresholdMs) {
          onIceConnectionInactive();
        }
      });
    }, this._activityCheckPeriodMs);
  }

  /**
   * Stop monitoring the ICE connection state.
   * @returns {void}
   */
  stop() {
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
      this._lastActivity = null;
    }
  }
}

module.exports = IceConnectionMonitor;
