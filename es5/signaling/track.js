'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var EventEmitter = require('events').EventEmitter;
var util = require('../util');

/**
 * A {@link Track} implementation
 * @extends EventEmitter
 * @property {Track.ID} id
 * @property {boolean} isEnabled
 * @property {Track.Kind} kind
 * @property {?TrackTransceiver} trackTransceiver
 * @property {?Track.SID} sid
 */

var TrackSignaling = function (_EventEmitter) {
  _inherits(TrackSignaling, _EventEmitter);

  /**
   * Construct a {@link TrackSignaling}.
   * @param {string} name
   * @param {Track.ID} id
   * @param {Track.Kind} kind
   * @param {boolean} isEnabled
   */
  function TrackSignaling(name, id, kind, isEnabled) {
    _classCallCheck(this, TrackSignaling);

    var _this = _possibleConstructorReturn(this, (TrackSignaling.__proto__ || Object.getPrototypeOf(TrackSignaling)).call(this));

    var sid = null;
    var trackTransceiver = null;
    Object.defineProperties(_this, {
      _isEnabled: {
        value: isEnabled,
        writable: true
      },
      _trackTransceiver: {
        get: function get() {
          return trackTransceiver;
        },
        set: function set(_trackTransceiver) {
          if (trackTransceiver === null) {
            trackTransceiver = _trackTransceiver;
            this._trackTransceiverDeferred.resolve(trackTransceiver);
          }
        }
      },
      _trackTransceiverDeferred: {
        value: util.defer()
      },
      _sid: {
        get: function get() {
          return sid;
        },
        set: function set(_sid) {
          if (sid === null) {
            sid = _sid;
          }
        }
      },
      id: {
        enumerable: true,
        value: id
      },
      isEnabled: {
        enumerable: true,
        get: function get() {
          return this._isEnabled;
        }
      },
      kind: {
        enumerable: true,
        value: kind
      },
      trackTransceiver: {
        enumerable: true,
        get: function get() {
          return trackTransceiver;
        }
      },
      name: {
        enumerable: true,
        value: name
      },
      sid: {
        enumerable: true,
        get: function get() {
          return sid;
        }
      }
    });
    return _this;
  }

  /**
   * Disable the {@link TrackSignaling} if it is not already disabled.
   * @return {this}
   */


  _createClass(TrackSignaling, [{
    key: 'disable',
    value: function disable() {
      return this.enable(false);
    }

    /**
     * Enable (or disable) the {@link TrackSignaling} if it is not already enabled
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

    /**
     * Get the {@link TrackTransceiver} on the @link TrackSignaling}.
     * @returns {Promise<TrackTransceiver>}
     */

  }, {
    key: 'getTrackTransceiver',
    value: function getTrackTransceiver() {
      return this._trackTransceiverDeferred.promise;
    }

    /**
     * Set the {@link TrackTransceiver} on the {@link TrackSignaling}.
     * @param {TrackTransceiver} trackTransceiver
     * @returns {this}
     */

  }, {
    key: 'setTrackTransceiver',
    value: function setTrackTransceiver(trackTransceiver) {
      this._trackTransceiver = trackTransceiver;
      return this;
    }

    /**
     * Set the SID on the {@link TrackSignaling} once.
     * @param {string} sid
     * @returns {this}
     */

  }, {
    key: 'setSid',
    value: function setSid(sid) {
      if (this._sid === null) {
        this._sid = sid;
        this.emit('updated');
      }
      return this;
    }
  }]);

  return TrackSignaling;
}(EventEmitter);

/**
 * Emitted whenever the {@link TrackSignaling} is updated
 * @event TrackSignaling#updated
 */

module.exports = TrackSignaling;