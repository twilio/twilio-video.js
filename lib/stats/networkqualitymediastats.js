'use strict';

const NetworkQualitySendStats = require('./networkqualitysendstats');
const NetworkQualityRecvStats = require('./networkqualityrecvstats');

/**
 * Network quality statistics shared between a {@link Participant}'s audio or video.
 * @property {NetworkQualityLevel} send - {@link NetworkQualityLevel} of the
 *  {@link Participant}'s published audio or video
 * @property {number} recv - {@link NetworkQualityLevel} of the
 *  {@link Participant}'s subscribed audio or video
 * @property {?NetworkQualitySendOrRecvStats} sendStats - {@link NetworkQualitySendOrRecvStats}
 *   based on which {@link NetworkQualityMediaStats}<code style="padding:0 0">#send</code>
 *   is calculated
 * @property {?NetworkQualitySendOrRecvStats} recvStats - {@link NetworkQualitySendOrRecvStats}
 *   based on which {@link NetworkQualityMediaStats}<code style="padding:0 0">#recv</code>
 *   is calculated
 */
class NetworkQualityMediaStats {
  /**
   * Construct a {@link NetworkQualityMediaStats}.
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
