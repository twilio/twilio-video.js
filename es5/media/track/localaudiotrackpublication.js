'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var LocalTrackPublication = require('./localtrackpublication');

/**
 * A {@link LocalAudioTrackPublication} is a {@link LocalAudioTrack} that has
 * been published to a {@link Room}.
 * @extends LocalTrackPublication
 * @property {Track.Kind} kind - "audio"
 * @property {LocalAudioTrack} track - the {@link LocalAudioTrack}
 */

var LocalAudioTrackPublication = function (_LocalTrackPublicatio) {
  _inherits(LocalAudioTrackPublication, _LocalTrackPublicatio);

  /**
   * Construct a {@link LocalAudioTrackPublication}.
   * @param {LocalTrackPublicationSignaling} signaling - The corresponding
   *   {@link LocalTrackPublicationSignaling}
   * @param {LocalAudioTrack} track - the {@link LocalAudioTrack}
   * @param {function(LocalTrackPublication): void} unpublish - The callback
   *    that unpublishes the {@link LocalTrackPublication}
   * @param {TrackPublicationOptions} options - {@link LocalTrackPublication} options
   */
  function LocalAudioTrackPublication(signaling, track, unpublish, options) {
    _classCallCheck(this, LocalAudioTrackPublication);

    return _possibleConstructorReturn(this, (LocalAudioTrackPublication.__proto__ || Object.getPrototypeOf(LocalAudioTrackPublication)).call(this, signaling, track, unpublish, options));
  }

  _createClass(LocalAudioTrackPublication, [{
    key: 'toString',
    value: function toString() {
      return '[LocalAudioTrackPublication #' + this._instanceId + ': ' + this.trackSid + ']';
    }
  }]);

  return LocalAudioTrackPublication;
}(LocalTrackPublication);

module.exports = LocalAudioTrackPublication;