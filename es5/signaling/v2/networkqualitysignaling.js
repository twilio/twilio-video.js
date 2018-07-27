'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require('events'),
    EventEmitter = _require.EventEmitter;

var AsyncVar = require('../../util/asyncvar');

/**
 * @interface MediaSignalingTransport
 * @property {function(object): boolean} send
 * @emits MediaSignalingTransport#message
 */

/**
 * The {@link MediaSignalingTransport} received a message.
 * @event MediaSignalingTransport#message
 * @param {object} message
 */

/**
 * @interface SendAndReceiveLevels
 * @deprecated - the decomposed levels are only used for debugging and will be
 *   removed as soon as we are confident in our implementation
 * @property {number} send
 * @property {number} recv
 */

/**
 * @interface NetworkQualityLevels
 * @deprecated - the decomposed levels are only used for debugging and will be
 *   removed as soon as we are confident in our implementation
 * @property {SendAndReceiveLevels} audio
 * @property {SendAndReceiveLevels} video
 */

/**
 * @typedef {PeerConnectionSummary} NetworkQualityInputs
 */

/**
 * @classdesc The {@link NetworkQualitySignaling} class allows submitting
 *   {@link NetworkQualityInputs} for computing {@link NetworkQualityLevel}. It
 *   does so by sending and receivin messages over a
 *   {@link MediaSignalingTransport}. The exact transport used depends on the
 *   topology of the {@link Room} that {@link NetworkQualitySignaling} is being
 *   used within: for P2P Rooms, we re-use the {@link TransportV2}; and for
 *   Group Rooms, we use a {@link DataTransport}.
 * @emits NetworkQualitySignaling#updated
 */

var NetworkQualitySignaling = function (_EventEmitter) {
  _inherits(NetworkQualitySignaling, _EventEmitter);

  /**
   * Construct a {@link NetworkQualitySignaling}.
   * @param {MediaSignalingTransport} mediaSignalingTransport
   */
  function NetworkQualitySignaling(mediaSignalingTransport) {
    _classCallCheck(this, NetworkQualitySignaling);

    var _this = _possibleConstructorReturn(this, (NetworkQualitySignaling.__proto__ || Object.getPrototypeOf(NetworkQualitySignaling)).call(this));

    Object.defineProperties(_this, {
      _level: {
        value: null,
        writable: true
      },
      _levels: {
        value: null,
        writable: true
      },
      _mediaSignalingTransport: {
        value: mediaSignalingTransport
      },
      _networkQualityInputs: {
        value: new AsyncVar()
      }
    });

    mediaSignalingTransport.on('message', function (message) {
      switch (message.type) {
        case 'network_quality':
          _this._handleNetworkQualityMessage(message);
          break;
        default:
          break;
      }
    });

    _this._sendNetworkQualityInputs();
    return _this;
  }

  /**
   * Get the current {@link NetworkQualityLevel}, if any.
   * @returns {?NetworkQualityLevel} level - initially null
   */


  _createClass(NetworkQualitySignaling, [{
    key: '_handleNetworkQualityMessage',


    /**
     * Check to see if the {@link NetworkQualityLevel} is new, and raise an
     * event if necessary.
     * @private
     * @param {object} message
     * @returns {void}
     */
    value: function _handleNetworkQualityMessage(message) {
      var _this2 = this;

      var level = null;
      var local = message ? message.local : null;
      if (typeof local === 'number') {
        // NOTE(mroberts): In prod, we plan to only send the level.
        level = local;
        this._levels = null;
      } else if ((typeof local === 'undefined' ? 'undefined' : _typeof(local)) === 'object' && local) {
        // NOTE(mroberts): In dev, we plan to send the decomposed levels. An early
        // VMS version does not compute `level` for us, so we fallback to taking
        // the minimum ourselves.
        this._levels = local;
        level = typeof local.level === 'number' ? local.level : Math.min(local.audio.send, local.audio.recv, local.video.send, local.video.recv);
      }
      if (level !== null && this.level !== level) {
        this._level = level;
        this.emit('updated');
      }
      setTimeout(function () {
        return _this2._sendNetworkQualityInputs();
      }, 1000);
    }

    /**
     * Start sending {@link NetworkQualityInputs}.
     * @private
     * @returns {Promise<void>}
     */

  }, {
    key: '_sendNetworkQualityInputs',
    value: function _sendNetworkQualityInputs() {
      var _this3 = this;

      return this._networkQualityInputs.take().then(function (networkQualityInputs) {
        _this3._mediaSignalingTransport.publish(createNetworkQualityInputsMessage(networkQualityInputs));
      });
    }

    /**
     * Put {@link NetworkQualityInputs} to be used for computing
     * {@link NetworkQualityLevel}.
     * @param {NetworkQualityInputs} networkQualityInputs
     * @returns {void}
     */

  }, {
    key: 'put',
    value: function put(networkQualityInputs) {
      this._networkQualityInputs.put(networkQualityInputs);
    }
  }, {
    key: 'level',
    get: function get() {
      return this._level;
    }

    /**
     * Get the current {@link NetworkQualityLevels}, if any.
     * @deprecated - the decomposed levels are only used for debugging and will be
     *  removed as soon as we are confident in our implementation
     * @returns {?NetworkQualityLevels} levels - initially null
     */

  }, {
    key: 'levels',
    get: function get() {
      return this._levels;
    }
  }]);

  return NetworkQualitySignaling;
}(EventEmitter);

/**
 * The {@link NetworkQualityLevel} changed.
 * @event NetworkQualitySignaling#updated
 */

/**
 * @param {NetworkQualityInputs} networkQualityInputs
 * @returns {object} message
 */


function createNetworkQualityInputsMessage(networkQualityInputs) {
  return Object.assign({
    type: 'network_quality'
  }, networkQualityInputs);
}

module.exports = NetworkQualitySignaling;