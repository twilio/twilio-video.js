/* eslint callback-return:0 */
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var EventEmitter = require('events');

var nInstances = 0;

var MediaSignaling = function (_EventEmitter) {
  _inherits(MediaSignaling, _EventEmitter);

  /**
   * Construct a {@link MediaSignaling}.
   * @param {Promise<DataTrackReceiver>} getReceive
   * @param {string} channel
   */
  function MediaSignaling(getReceiver, channel, options) {
    _classCallCheck(this, MediaSignaling);

    var _this = _possibleConstructorReturn(this, (MediaSignaling.__proto__ || Object.getPrototypeOf(MediaSignaling)).call(this));

    Object.defineProperties(_this, {
      _instanceId: {
        value: nInstances++
      },
      channel: {
        value: channel
      },
      _log: {
        value: options.log.createLog('default', _this)
      },
      _getReceiver: {
        value: getReceiver
      },
      _receiverPromise: {
        value: null,
        writable: true
      },
      _transport: {
        value: null,
        writable: true
      }
    });
    return _this;
  }

  _createClass(MediaSignaling, [{
    key: 'toString',
    value: function toString() {
      return '[MediaSignaling #' + this._instanceId + ':' + this.channel + ']';
    }
  }, {
    key: 'setup',
    value: function setup(id) {
      var _this2 = this;

      this._teardown();
      this._log.info('setting up msp transport for id:', id);
      var receiverPromise = this._getReceiver(id).then(function (receiver) {
        if (receiver.kind !== 'data') {
          _this2._log.error('Expected a DataTrackReceiver');
          throw new Error('Expected a DataTrackReceiver');
        }if (_this2._receiverPromise !== receiverPromise) {
          return;
        }

        try {
          _this2._transport = receiver.toDataTransport();
        } catch (ex) {
          _this2._log.error('Failed to toDataTransport');
          throw new Error('Failed to toDataTransport');
        }
        _this2.emit('ready', _this2._transport);

        receiver.once('close', function () {
          return _this2._teardown();
        });
      });
      this._receiverPromise = receiverPromise;
    }
  }, {
    key: '_teardown',
    value: function _teardown() {
      if (this._transport) {
        this._log.info('Tearing down');
        this._transport = null;
        this._receiverPromise = null;
        this.emit('teardown');
      }
    }
  }, {
    key: 'isSetup',
    get: function get() {
      return !!this._receiverPromise;
    }
  }]);

  return MediaSignaling;
}(EventEmitter);

module.exports = MediaSignaling;