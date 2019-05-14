'use strict';

const { ICE_MONITOR_ACTIVITY_CHECK_PERIOD_MS, ICE_MONITOR_INACTIVITY_THRESHOLD_MS } = require('../../util/constants');

/**
 * @emits IceMediaMonitor#updated
 */
class IceMediaMonitor {
  /**
   * Construct a {@link IceMediaMonitor}.
   */
  constructor(pc, options) {
    options = Object.assign({
      activityCheckPeriodMS: ICE_MONITOR_ACTIVITY_CHECK_PERIOD_MS,
      inactivityThresholdMS: ICE_MONITOR_INACTIVITY_THRESHOLD_MS,
    }, options);

    Object.defineProperties(this, {
      _pc: {
        value: pc
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

  _getMediaStats() {
    return this._pc.getMediaStats();
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

module.exports = IceMediaMonitor;
