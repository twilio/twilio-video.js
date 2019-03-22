'use strict';

const NetworkQualitySendStats = require('./networkqualitysendstats');
const NetworkQualityRecvStats = require('./networkqualityrecvstats');

/**
 * Network quality statistics for audio or video.
 * @property {number} send
 * @property {number} recv
 * @property {?NetworkQualitySendOrRecvStats} sendStats
 * @property {?NetworkQualitySendOrRecvStats} recvStats
 */
class NetworkQualityMediaStats {

  /**
   * @param {MediaLevels} mediaLevels
   */
  constructor({ send, recv, sendStats = null, recvStats = null }) {
    Object.defineProperties(this, {
      send: {
        value: send,
        enumerable: true
      },
      recv: {
        value: recv,
        enumerable: true
      },
      sendStats: {
        value: sendStats ? new NetworkQualitySendStats(sendStats) : null,
        enumerable: true
      },
      recvStats: {
        value: recvStats ? new NetworkQualityRecvStats(recvStats) : null,
        enumerable: true
      }
    });
  }
}

module.exports = NetworkQualityMediaStats;
