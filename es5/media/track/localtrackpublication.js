'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var TrackPublication = require('./trackpublication');

/**
 * A {@link LocalTrackPublication} is a {@link LocalTrack} that has been
 * published to a {@link Room}.
 * @extends TrackPublication
 * @property {Track.Kind} kind - kind of the published {@link LocalTrack}
 * @property {LocalTrack} track - the {@link LocalTrack}
 */

var LocalTrackPublication = function (_TrackPublication) {
  _inherits(LocalTrackPublication, _TrackPublication);

  /**
   * Construct a {@link LocalTrackPublication}.
   * @param {Track.SID} trackSid - SID assigned to the published {@link LocalTrack}
   * @param {LocalTrack} track - the {@link LocalTrack}
   * @param {function(LocalTrackPublication): void} unpublish - The callback
   *   that unpublishes the {@link LocalTrackPublication}
   * @param {TrackPublicationOptions} options - {@link LocalTrackPublication}
   *   options
   */
  function LocalTrackPublication(trackSid, track, unpublish, options) {
    _classCallCheck(this, LocalTrackPublication);

    var _this = _possibleConstructorReturn(this, (LocalTrackPublication.__proto__ || Object.getPrototypeOf(LocalTrackPublication)).call(this, track.name, trackSid, options));

    Object.defineProperties(_this, {
      _reemitTrackEvent: {
        value: function value() {
          return _this.emit(_this.isTrackEnabled ? 'trackEnabled' : 'trackDisabled');
        }
      },
      _unpublish: {
        value: unpublish
      },
      kind: {
        enumerable: true,
        value: track.kind
      },
      track: {
        enumerable: true,
        value: track
      }
    });

    track.on('disabled', _this._reemitTrackEvent);
    track.on('enabled', _this._reemitTrackEvent);
    return _this;
  }

  _createClass(LocalTrackPublication, [{
    key: 'toString',
    value: function toString() {
      return '[LocalTrackPublication #' + this._instanceId + ': ' + this.trackSid + ']';
    }

    /**
     * Whether the published {@link LocalTrack} is enabled
     * @property {boolean}
     */

  }, {
    key: 'unpublish',


    /**
     * Unpublish a {@link LocalTrackPublication}. This means that the media
     * from this {@link LocalTrackPublication} is no longer available to the
     * {@link Room}'s {@link RemoteParticipant}s.
     * @returns {this}
     */
    value: function unpublish() {
      this.track.removeListener('disabled', this._reemitTrackEvent);
      this.track.removeListener('enabled', this._reemitTrackEvent);
      this._unpublish(this);
      return this;
    }
  }, {
    key: 'isTrackEnabled',
    get: function get() {
      return this.track.kind === 'data' ? true : this.track.isEnabled;
    }
  }]);

  return LocalTrackPublication;
}(TrackPublication);

module.exports = LocalTrackPublication;