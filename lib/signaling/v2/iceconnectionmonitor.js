'use strict';

const { ICE_ACTIVITY_CHECK_PERIOD_MS, ICE_INACTIVITY_THRESHOLD_MS } = require('../../util/constants');

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

  // TODO: remove this before merging.
  _makarandlog() {
    var newArgs = ['makarand: '];
    var args = Array.prototype.slice.call(arguments);
    console.log.apply(console.log, newArgs.concat(args));
  }

  /**
   * Get ICE connection stats.
   * @returns Promise<{?RTCIceCandidatePairStats}>
   */
  _getIceConnectionStats() {
    return this._peerConnection.getStats().then(stats => Array.from(stats.values()).find(stat => {
      return stat.type === 'candidate-pair' && stat.nominated;
    }));
  }

  /**
   * returns ICE connection stats or null.
   * @returns Promise<?{timestamp, bytesReceived, bytesSent}>
   */
  _getStats() {
    return this._getIceConnectionStats().then((activeCandidatePairStats) => {
      if (!activeCandidatePairStats) {
        return null;
      }
      return {
        timestamp: activeCandidatePairStats.timestamp,
        bytesReceived: activeCandidatePairStats.bytesReceived,
        bytesSent: activeCandidatePairStats.bytesSent
      };
    }).catch(() => {
      return null;
    });
  }

  /**
   * Start monitoring.
   * @returns {void}
   */
  start(onIceConnectionInactive) {
    console.trace("makarand: start was called!");
    this._makarandlog('starting MediaTimer');
    this.stop();
    this._timer = setInterval(() => {
      this._getStats().then(iceStats => {
        if (!iceStats) {
          return;
        }

        if (this._lastActivity ) {
          this._makarandlog('Diff: ', {
            time: iceStats.timestamp - this._lastActivity.timestamp,
            received: iceStats.bytesReceived - this._lastActivity.bytesReceived,
            sent: iceStats.bytesSent - this._lastActivity.bytesSent
          });
        }

        // if change detected in bytesReceived mark it as lastActiveiy.
        if (!this._lastActivity || this._lastActivity.bytesReceived !== iceStats.bytesReceived) {
          this._lastActivity = iceStats;
        }

        // after inactivity threshold fire inactiveCallback.
        if (iceStats.timestamp - this._lastActivity.timestamp >= this._inactivityThresholdMs) {
          onIceConnectionInactive();
        }
      }).catch((err) => {
        this._makarandlog('error in _restartIceIfInactiveForLong', err);
      });
    }, this._activityCheckPeriodMs);
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
      this._lastActivity = null;
    }
  }
}

module.exports = IceConnectionMonitor;
