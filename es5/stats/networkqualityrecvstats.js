'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var NetworkQualitySendOrRecvStats = require('./networkqualitysendorrecvstats');

/**
 * {@link NetworkQualitySendOrRecvStats} based on which a {@link Participant}'s
 * {@link NetworkQualityMediaStats}<code style="padding:0 0">#recv</code> is calculated.
 */

var NetworkQualityRecvStats = function (_NetworkQualitySendOr) {
  _inherits(NetworkQualityRecvStats, _NetworkQualitySendOr);

  /**
   * Construct a {@link NetworkQualityRecvStats}.
   * @param {SendOrRecvStats} sendOrRecvStats
   */
  function NetworkQualityRecvStats(sendOrRecvStats) {
    _classCallCheck(this, NetworkQualityRecvStats);

    return _possibleConstructorReturn(this, (NetworkQualityRecvStats.__proto__ || Object.getPrototypeOf(NetworkQualityRecvStats)).call(this, sendOrRecvStats));
  }

  return NetworkQualityRecvStats;
}(NetworkQualitySendOrRecvStats);

module.exports = NetworkQualityRecvStats;