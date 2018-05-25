/* eslint callback-return:0 */
'use strict';

const EventEmitter = require('events');

const PeerConnectionReportFactory = require('../../stats/peerconnectionreportfactory');

/**
 * @property {NetworkQualityLevels} levels
 * @emits NetworkQualityMonitor#updated
 */
class NetworkQualityMonitor extends EventEmitter {
  /**
   * Construct a {@link NetworkQualityMonitor}.
   * @param {PeerConnectionManager} manager
   * @param {NetworkQualitySignaling} signaling
   */
  constructor(manager, signaling) {
    super();
    Object.defineProperties(this, {
      _factories: {
        value: new WeakMap()
      },
      _manager: {
        value: manager
      },
      _signaling: {
        value: signaling
      },
      levels: {
        enumerable: true,
        value: null,
        writable: true
      }
    });
    signaling.on('networkQualityLevelsChanged', levels => {
      this.levels = levels;
      this.emit('updated', levels);
    });
  }

  /**
   * @returns {number}
   */
  get level() {
    return this.levels
      ? Math.min(
        this.levels.audio.send,
        this.levels.audio.recv,
        this.levels.video.send,
        this.levels.video.recv)
      : null;
  }

  /**
   * Start monitoring.
   * @returns {void}
   */
  start() {
    this.stop();
    const timeout = setTimeout(() => {
      if (this._timeout !== timeout) {
        return;
      }
      next(this).then(reports => {
        if (this._timeout !== timeout) {
          return;
        }
        if (reports.length) {
          const [report] = reports;
          this._signaling.put(report);
        }
        this.start();
      });
    }, 200);
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

/**
 * @param {NetworkQualityMonitor}
 * @returns {Promise<NetworkQualityInputs>}
 */
function next(monitor) {
  const pcv2s = monitor._manager._peerConnections
    ? Array.from(monitor._manager._peerConnections.values())
    : [];

  const pcs = pcv2s
    .map(pcv2 => pcv2._peerConnection)
    .filter(pc => pc.signalingState !== 'closed');

  const factories = pcs.map(pc => {
    if (monitor._factories.has(pc)) {
      return monitor._factories.get(pc);
    }
    const factory = new PeerConnectionReportFactory(pc);
    monitor._factories.set(pc, factory);
    return factory;
  });

  const reportsOrNullPromises = factories.map(factory => factory.next().catch(() => null));

  return Promise.all(reportsOrNullPromises).then(reportsOrNull => reportsOrNull
    .filter(reportOrNull => reportOrNull)
    .map(report => report.summarize()));
}


module.exports = NetworkQualityMonitor;
