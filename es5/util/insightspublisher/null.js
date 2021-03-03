// eslint-disable-next-line no-warning-comments
// TODO(mroberts): This should be described as implementing some
// InsightsPublisher interface.
'use strict';

/**
 * Null Insights publisher.
 */

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var InsightsPublisher = function () {
  function InsightsPublisher() {
    _classCallCheck(this, InsightsPublisher);

    Object.defineProperties(this, {
      _connected: {
        writable: true,
        value: true
      }
    });
  }

  /**
   * Connect
   * @returns {void}
   */


  _createClass(InsightsPublisher, [{
    key: 'connect',
    value: function connect() {}

    /**
     * Disconnect.
     * @returns {boolean}
     */

  }, {
    key: 'disconnect',
    value: function disconnect() {
      if (this._connected) {
        this._connected = false;
        return true;
      }
      return false;
    }

    /**
     * Publish.
     * @returns {boolean}
     */

  }, {
    key: 'publish',
    value: function publish() {
      return this._connected;
    }
  }]);

  return InsightsPublisher;
}();

module.exports = InsightsPublisher;