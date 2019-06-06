'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var TrackSignaling = require('./track');

/**
 * A {@link LocalTrackPublication} implementation
 * @extends TrackSignaling
 * @property {?Error} error - non-null if publication failed
 * @property {Track.ID} id
 */

var LocalTrackPublicationSignaling = function (_TrackSignaling) {
  _inherits(LocalTrackPublicationSignaling, _TrackSignaling);

  /**
   * Construct a {@link LocalTrackPublicationSignaling}.
   * @param {DataTrackSender|MediaTrackSender} trackSender
   * @param {string} name
   */
  function LocalTrackPublicationSignaling(trackSender, name) {
    _classCallCheck(this, LocalTrackPublicationSignaling);

    var enabled = trackSender.kind === 'data' ? true : trackSender.track.enabled;

    var _this = _possibleConstructorReturn(this, (LocalTrackPublicationSignaling.__proto__ || Object.getPrototypeOf(LocalTrackPublicationSignaling)).call(this, name, trackSender.kind, enabled));

    _this.setTrackTransceiver(trackSender);
    Object.defineProperties(_this, {
      _error: {
        value: null,
        writable: true
      },
      error: {
        enumerable: true,
        get: function get() {
          return this._error;
        }
      },
      id: {
        enumerable: true,
        value: trackSender.id
      }
    });
    return _this;
  }

  /**
   * Rejects the SID's deferred promise with the given Error.
   * @param {Error} error
   * @returns {this}
   */


  _createClass(LocalTrackPublicationSignaling, [{
    key: 'publishFailed',
    value: function publishFailed(error) {
      if (setError(this, error)) {
        this.emit('updated');
      }
      return this;
    }
  }, {
    key: 'setSid',
    value: function setSid(sid) {
      if (this._error) {
        return this;
      }
      return _get(LocalTrackPublicationSignaling.prototype.__proto__ || Object.getPrototypeOf(LocalTrackPublicationSignaling.prototype), 'setSid', this).call(this, sid);
    }
  }]);

  return LocalTrackPublicationSignaling;
}(TrackSignaling);

/**
 * @param {LocalTrackPublication} publication
 * @param {Error} error
 * @returns {boolean} updated
 */


function setError(publication, error) {
  if (publication._sid !== null || publication._error) {
    return false;
  }
  publication._error = error;
  return true;
}

module.exports = LocalTrackPublicationSignaling;