'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var EventEmitter = require('events').EventEmitter;

/**
 * Represents recording state
 * @extends EventEmitter
 * @property {?boolean} isEnabled
 */

var RecordingSignaling = function (_EventEmitter) {
  _inherits(RecordingSignaling, _EventEmitter);

  /**
   * Construct a {@link RecordingSignaling}.
   */
  function RecordingSignaling() {
    _classCallCheck(this, RecordingSignaling);

    var _this = _possibleConstructorReturn(this, (RecordingSignaling.__proto__ || Object.getPrototypeOf(RecordingSignaling)).call(this));

    Object.defineProperties(_this, {
      _isEnabled: {
        value: null,
        writable: true
      },
      isEnabled: {
        enumerable: true,
        get: function get() {
          return this._isEnabled;
        }
      }
    });
    return _this;
  }

  /**
   * Disable the {@link RecordingSignaling} if it is not already disabled.
   * @return {this}
   */


  _createClass(RecordingSignaling, [{
    key: 'disable',
    value: function disable() {
      return this.enable(false);
    }

    /**
     * Enable (or disable) the {@link RecordingSignaling} if it is not already enabled
     * (or disabled).
     * @param {boolean} [enabled=true]
     * @return {this}
     */

  }, {
    key: 'enable',
    value: function enable(enabled) {
      enabled = typeof enabled === 'boolean' ? enabled : true;
      if (this.isEnabled !== enabled) {
        this._isEnabled = enabled;
        this.emit('updated');
      }
      return this;
    }
  }]);

  return RecordingSignaling;
}(EventEmitter);

/**
 * Emitted whenever the {@link RecordingSignaling} is updated
 * @event RecordingSignaling#updated
 */

module.exports = RecordingSignaling;