'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require('events'),
    EventEmitter = _require.EventEmitter;

/**
 * A {@link Track} implementation
 * @extends EventEmitter
 * @property {Track.Kind} kind
 * @property {string} name
 */


var TrackSignaling = function (_EventEmitter) {
  _inherits(TrackSignaling, _EventEmitter);

  /**
   * Construct a {@link TrackSignaling}.
   * @param {string} name
   * @param {Track.Kind} kind
   * @param {boolean} isEnabled
   * @param {Track.Priority} priority
   */
  function TrackSignaling(name, kind, isEnabled, priority) {
    _classCallCheck(this, TrackSignaling);

    var _this = _possibleConstructorReturn(this, (TrackSignaling.__proto__ || Object.getPrototypeOf(TrackSignaling)).call(this));

    var sid = null;
    Object.defineProperties(_this, {
      _error: {
        value: null,
        writable: true
      },
      _isEnabled: {
        value: isEnabled,
        writable: true
      },
      _priority: {
        value: priority,
        writable: true
      },
      _trackTransceiver: {
        value: null,
        writable: true
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
      kind: {
        enumerable: true,
        value: kind
      },
      name: {
        enumerable: true,
        value: name
      }
    });
    return _this;
  }

  /**
   * Non-null if publication or subscription failed.
   * @property {?Error} error
   */


  _createClass(TrackSignaling, [{
    key: 'disable',


    /**
     * Disable the {@link TrackSignaling} if it is not already disabled.
     * @return {this}
     */
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
     * Set the {@link TrackTransceiver} on the {@link TrackSignaling}.
     * @param {TrackTransceiver} trackTransceiver
     * @returns {this}
     */

  }, {
    key: 'setTrackTransceiver',
    value: function setTrackTransceiver(trackTransceiver) {
      trackTransceiver = trackTransceiver || null;
      if (this.trackTransceiver !== trackTransceiver) {
        this._trackTransceiver = trackTransceiver;
        this.emit('updated');
      }
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
      if (this.sid === null) {
        this._sid = sid;
        this.emit('updated');
      }
      return this;
    }
  }, {
    key: 'error',
    get: function get() {
      return this._error;
    }

    /**
     * Whether the {@link TrackSignaling} is enabled.
     * @property {boolean}
     */

  }, {
    key: 'isEnabled',
    get: function get() {
      return this._isEnabled;
    }

    /**
     * The {@link TrackSignaling}'s priority.
     * @property {Track.Priority}
     */

  }, {
    key: 'priority',
    get: function get() {
      return this._priority;
    }

    /**
     * The {@link TrackSignaling}'s {@link Track.SID}.
     * @property {Track.SID}
     */

  }, {
    key: 'sid',
    get: function get() {
      return this._sid;
    }

    /**
     * The {@link TrackSignaling}'s {@link TrackTransceiver}.
     * @property {TrackTransceiver}
     */

  }, {
    key: 'trackTransceiver',
    get: function get() {
      return this._trackTransceiver;
    }
  }]);

  return TrackSignaling;
}(EventEmitter);

/**
 * Emitted whenever the {@link TrackSignaling} is updated
 * @event TrackSignaling#updated
 */

module.exports = TrackSignaling;