'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var EventEmitter = require('events').EventEmitter;

var instances = 0;

/**
 * A {@link ConstantIceServerSource} only ever returns a single set of ICE
 * servers. It is useful for providing a hard-coded set of ICE servers.
 * @extends EventEmitter
 * @implements {IceServerSource}
 */

var ConstantIceServerSource = function (_EventEmitter) {
  _inherits(ConstantIceServerSource, _EventEmitter);

  /**
   * Construct a {@link ConstantIceServerSource}.
   * @param {Array<RTCIceServerInit>} iceServers
   */
  function ConstantIceServerSource(iceServers) {
    _classCallCheck(this, ConstantIceServerSource);

    var _this = _possibleConstructorReturn(this, (ConstantIceServerSource.__proto__ || Object.getPrototypeOf(ConstantIceServerSource)).call(this));

    Object.defineProperties(_this, {
      _instance: {
        value: ++instances
      },
      _iceServers: {
        enumerable: true,
        value: iceServers,
        writable: true
      },
      _isStarted: {
        value: false,
        writable: true
      },
      isStarted: {
        enumerable: true,
        get: function get() {
          return this._isStarted;
        }
      },
      status: {
        enumerable: true,
        value: 'overrode'
      }
    });
    return _this;
  }

  _createClass(ConstantIceServerSource, [{
    key: 'start',
    value: function start() {
      this._isStarted = true;
      return Promise.resolve(this._iceServers);
    }
  }, {
    key: 'stop',
    value: function stop() {
      this._isStarted = false;
    }
  }, {
    key: 'toString',
    value: function toString() {
      return '[ConstantIceServerSource #' + this._instance + ']';
    }
  }]);

  return ConstantIceServerSource;
}(EventEmitter);

module.exports = ConstantIceServerSource;