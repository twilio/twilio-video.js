'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var LocalTrackPublication = require('./localtrackpublication');

/**
 * A {@link LocalDataTrackPublication} is a {@link LocalDataTrack} that has been
 * published to a {@link Room}.
 * @extends LocalTrackPublication
 * @property {Track.Kind} kind - "data"
 * @property {LocalDataTrack} track - the {@link LocalDataTrack}
 */

var LocalDataTrackPublication = function (_LocalTrackPublicatio) {
  _inherits(LocalDataTrackPublication, _LocalTrackPublicatio);

  /**
   * Construct a {@link LocalDataTrackPublication}.
   * @param {Track.SID} trackSid - SID assigned to the published {@link LocalDataTrack}
   * @param {LocalDataTrack} track - the {@link LocalDataTrack}
   * @param {function(LocalTrackPublication): void} unpublish - The callback
   *    that unpublishes the {@link LocalTrackPublication}
   * @param {TrackPublicationOptions} options - {@link LocalTrackPublication} options
   */
  function LocalDataTrackPublication(trackSid, track, unpublish, options) {
    _classCallCheck(this, LocalDataTrackPublication);

    return _possibleConstructorReturn(this, (LocalDataTrackPublication.__proto__ || Object.getPrototypeOf(LocalDataTrackPublication)).call(this, trackSid, track, unpublish, options));
  }

  _createClass(LocalDataTrackPublication, [{
    key: 'toString',
    value: function toString() {
      return '[LocalDataTrackPublication #' + this._instanceId + ': ' + this.trackSid + ']';
    }
  }]);

  return LocalDataTrackPublication;
}(LocalTrackPublication);

module.exports = LocalDataTrackPublication;