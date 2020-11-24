'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var LocalTrackPublication = require('./localtrackpublication');

/**
 * A {@link LocalVideoTrackPublication} is a {@link LocalVideoTrack} that has
 * been published to a {@link Room}.
 * @extends LocalTrackPublication
 * @property {Track.Kind} kind - "video"
 * @property {LocalVideoTrack} track - the {@link LocalVideoTrack}
 */

var LocalVideoTrackPublication = function (_LocalTrackPublicatio) {
  _inherits(LocalVideoTrackPublication, _LocalTrackPublicatio);

  /**
   * Construct a {@link LocalVideoTrackPublication}.
   * @param {LocalTrackPublicationSignaling} signaling - The corresponding
   *   {@link LocalTrackPublicationSignaling}
   * @param {LocalVideoTrack} track - the {@link LocalVideoTrack}
   * @param {function(LocalTrackPublication): void} unpublish - The callback
   *    that unpublishes the {@link LocalTrackPublication}
   * @param {TrackPublicationOptions} options - {@link LocalTrackPublication} options
   */
  function LocalVideoTrackPublication(signaling, track, unpublish, options) {
    _classCallCheck(this, LocalVideoTrackPublication);

    return _possibleConstructorReturn(this, (LocalVideoTrackPublication.__proto__ || Object.getPrototypeOf(LocalVideoTrackPublication)).call(this, signaling, track, unpublish, options));
  }

  _createClass(LocalVideoTrackPublication, [{
    key: 'toString',
    value: function toString() {
      return '[LocalVideoTrackPublication #' + this._instanceId + ': ' + this.trackSid + ']';
    }
  }]);

  return LocalVideoTrackPublication;
}(LocalTrackPublication);

module.exports = LocalVideoTrackPublication;