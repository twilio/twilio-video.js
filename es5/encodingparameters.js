'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var EventEmitter = require('events').EventEmitter;

/**
 * {@link EncodingParametersImpl} represents an object which notifies its
 * listeners of any changes in the values of its properties.
 * @extends EventEmitter
 * @implements EncodingParameters
 * @emits EncodingParametersImpl#changed
 * @property {?number} maxAudioBitrate
 * @property {?number} maxVideoBitrate
 */

var EncodingParametersImpl = function (_EventEmitter) {
  _inherits(EncodingParametersImpl, _EventEmitter);

  /**
   * Construct an {@link EncodingParametersImpl}.
   * @param {EncodingParamters} encodingParameters - Initial {@link EncodingParameters}
   */
  function EncodingParametersImpl(encodingParameters) {
    _classCallCheck(this, EncodingParametersImpl);

    var _this = _possibleConstructorReturn(this, (EncodingParametersImpl.__proto__ || Object.getPrototypeOf(EncodingParametersImpl)).call(this));

    encodingParameters = Object.assign({
      maxAudioBitrate: null,
      maxVideoBitrate: null
    }, encodingParameters);

    Object.defineProperties(_this, {
      maxAudioBitrate: {
        value: encodingParameters.maxAudioBitrate,
        writable: true
      },
      maxVideoBitrate: {
        value: encodingParameters.maxVideoBitrate,
        writable: true
      }
    });
    return _this;
  }

  /**
   * Returns the bitrate values in an {@link EncodingParameters}.
   * @returns {EncodingParameters}
   */


  _createClass(EncodingParametersImpl, [{
    key: 'toJSON',
    value: function toJSON() {
      return {
        maxAudioBitrate: this.maxAudioBitrate,
        maxVideoBitrate: this.maxVideoBitrate
      };
    }

    /**
     * Update the bitrate values with those in the given {@link EncodingParameters}.
     * @param {EncodingParameters} encodingParameters - The new {@link EncodingParameters}
     * @fires EncodingParametersImpl#changed
     */

  }, {
    key: 'update',
    value: function update(encodingParameters) {
      var _this2 = this;

      encodingParameters = Object.assign({
        maxAudioBitrate: this.maxAudioBitrate,
        maxVideoBitrate: this.maxVideoBitrate
      }, encodingParameters);

      var shouldEmitChanged = ['maxAudioBitrate', 'maxVideoBitrate'].reduce(function (shouldEmitChanged, maxKindBitrate) {
        if (_this2[maxKindBitrate] !== encodingParameters[maxKindBitrate]) {
          _this2[maxKindBitrate] = encodingParameters[maxKindBitrate];
          shouldEmitChanged = true;
        }
        return shouldEmitChanged;
      }, false);

      if (shouldEmitChanged) {
        this.emit('changed');
      }
    }
  }]);

  return EncodingParametersImpl;
}(EventEmitter);

/**
 * At least one of the {@link EncodingParametersImpl}'s bitrate values changed.
 * @event EncodingParametersImpl#changed
 */

module.exports = EncodingParametersImpl;