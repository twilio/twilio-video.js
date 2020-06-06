'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var TrackSignaling = require('./track');

/**
 * A {@link RemoteTrackPublication} implementation
 * @extends TrackSignaling
 */

var RemoteTrackPublicationSignaling = function (_TrackSignaling) {
  _inherits(RemoteTrackPublicationSignaling, _TrackSignaling);

  /**
   * Construct a {@link RemoteTrackPublicationSignaling}.
   * @param {Track.SID} sid
   * @param {string} name
   * @param {Track.Kind} kind
   * @param {boolean} isEnabled
   * @param {Track.Priority} priority
   */
  function RemoteTrackPublicationSignaling(sid, name, kind, isEnabled, priority) {
    _classCallCheck(this, RemoteTrackPublicationSignaling);

    var _this = _possibleConstructorReturn(this, (RemoteTrackPublicationSignaling.__proto__ || Object.getPrototypeOf(RemoteTrackPublicationSignaling)).call(this, name, kind, isEnabled, priority));

    Object.defineProperties(_this, {
      _isSwitchedOff: {
        value: false,
        writable: true
      }
    });
    _this.setSid(sid);
    return _this;
  }

  /**
   * Whether the {@link RemoteTrackPublicationSignaling} is subscribed to.
   * @property {boolean}
   */


  _createClass(RemoteTrackPublicationSignaling, [{
    key: 'subscribeFailed',


    /**
     * @param {Error} error
     * @returns {this}
     */
    value: function subscribeFailed(error) {
      if (!this.error) {
        this._error = error;
        this.emit('updated');
      }
      return this;
    }

    /**
     * Update the publish {@link Track.Priority}.
     * @param {Track.Priority} priority
     * @returns {this}
     */

  }, {
    key: 'setPriority',
    value: function setPriority(priority) {
      if (this._priority !== priority) {
        this._priority = priority;
        this.emit('updated');
      }
      return this;
    }

    /**
     * Updates track switch on/off state.
     * @param {boolean} isSwitchedOff
     * @returns {this}
     */

  }, {
    key: 'setSwitchedOff',
    value: function setSwitchedOff(isSwitchedOff) {
      if (this._isSwitchedOff !== isSwitchedOff) {
        this._isSwitchedOff = isSwitchedOff;
        this.emit('updated');
      }
      return this;
    }
  }, {
    key: 'isSubscribed',
    get: function get() {
      return !!this.trackTransceiver;
    }

    /**
     * Whether the {@link RemoteTrackPublicationSignaling} is switched off.
     * @property {boolean}
     */

  }, {
    key: 'isSwitchedOff',
    get: function get() {
      return this._isSwitchedOff;
    }
  }]);

  return RemoteTrackPublicationSignaling;
}(TrackSignaling);

module.exports = RemoteTrackPublicationSignaling;