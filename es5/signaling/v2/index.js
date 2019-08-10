'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var defaultCreateCancelableRoomSignalingPromise = require('./cancelableroomsignalingpromise');
var LocalParticipantV2 = require('./localparticipant');
var Signaling = require('../');

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

    /* eslint new-cap:0 */
    options = Object.assign({
      createCancelableRoomSignalingPromise: defaultCreateCancelableRoomSignalingPromise
    }, options);

    var _this = _possibleConstructorReturn(this, (SignalingV2.__proto__ || Object.getPrototypeOf(SignalingV2)).call(this));

    Object.defineProperties(_this, {
      _createCancelableRoomSignalingPromise: {
        value: options.createCancelableRoomSignalingPromise
      },
      _options: {
        value: options
      },
      _wsServer: {
        value: wsServer
      }
    });
    return _this;
  }

  /**
   * @private
   */


  _createClass(SignalingV2, [{
    key: '_connect',
    value: function _connect(localParticipant, token, iceServerSource, encodingParameters, preferredCodecs, options) {
      options = Object.assign({}, this._options, options);
      return this._createCancelableRoomSignalingPromise.bind(null, token, this._wsServer, localParticipant, iceServerSource, encodingParameters, preferredCodecs, options);
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