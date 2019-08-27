'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var constants = require('../../util/constants');
var defaultCreateCancelableRoomSignalingPromise = require('./cancelableroomsignalingpromise');
var LocalParticipantV2 = require('./localparticipant');
var Signaling = require('../');
var SIP = require('../../sip');
var SIPJSMediaHandler = require('./sipjsmediahandler');
var util = require('../../util');

/**
 * {@link SignalingV2} implements version 2 of our signaling protocol.
 * @extends Signaling
 */

var SignalingV2 = function (_Signaling) {
  _inherits(SignalingV2, _Signaling);

  /**
   * Construct {@link SignalingV2}.
   * @param {string} wsServer
   * @param {?object} [options={}]
   */
  function SignalingV2(wsServer, options) {
    _classCallCheck(this, SignalingV2);

    var uri = util.makeClientSIPURI();

    /* eslint new-cap:0 */
    options = Object.assign({
      createCancelableRoomSignalingPromise: defaultCreateCancelableRoomSignalingPromise,
      registrarServer: constants.REGISTRAR_SERVER,
      UA: SIP.UA
    }, options);

    var debug = options.logLevel === 'debug';
    var useWssHack = wsServer.startsWith('wss://');

    var UA = options.UA;
    var ua = new UA({
      autostart: false,
      log: {
        builtinEnabled: debug
      },
      extraSupported: ['room-signaling', 'timer'],
      hackAllowUnregisteredOptionTags: true,
      keepAliveInterval: 30,
      mediaHandlerFactory: SIPJSMediaHandler.defaultFactory,
      register: false,
      registrarServer: options.registrarServer,
      traceSip: debug,
      uri: uri,
      wsServers: wsServer,
      hackWssInTransport: useWssHack
    });

    var _this = _possibleConstructorReturn(this, (SignalingV2.__proto__ || Object.getPrototypeOf(SignalingV2)).call(this));

    Object.defineProperties(_this, {
      _createCancelableRoomSignalingPromise: {
        value: options.createCancelableRoomSignalingPromise
      },
      _options: {
        value: options
      },
      _ua: {
        value: ua
      }
    });
    return _this;
  }

  /**
   * @private
   */


  _createClass(SignalingV2, [{
    key: '_close',
    value: function _close(key) {
      this.transition('closing', key);
      this._ua.stop();
      this._ua.transport.disconnect();
      this.transition('closed', key);
      return Promise.resolve(this);
    }

    /**
     * @private
     */

  }, {
    key: '_open',
    value: function _open(key) {
      var _this2 = this;

      var ua = this._ua;

      function startUA() {
        ua.start();
      }

      this.transition('opening', key);
      return util.promiseFromEvents(startUA, ua, 'connected', 'disconnected').then(function () {
        _this2.transition('open', key);
        return _this2;
      }, function () {
        _this2.transition('closed', key);
        throw new Error('Open failed');
      });
    }

    /**
     * @private
     */

  }, {
    key: '_connect',
    value: function _connect(localParticipant, token, iceServerSource, encodingParameters, preferredCodecs, options) {
      options = Object.assign({}, this._options, options);

      var ua = this._ua;

      return this._createCancelableRoomSignalingPromise.bind(null, token, ua, localParticipant, iceServerSource, encodingParameters, preferredCodecs, options);
    }
  }, {
    key: 'createLocalParticipantSignaling',
    value: function createLocalParticipantSignaling(encodingParameters, networkQualityConfiguration) {
      return new LocalParticipantV2(encodingParameters, networkQualityConfiguration);
    }
  }]);

  return SignalingV2;
}(Signaling);

module.exports = SignalingV2;