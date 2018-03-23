'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var buildLogLevels = require('../../util').buildLogLevels;
var Log = require('../../util/log');
var DEFAULT_LOG_LEVEL = require('../../util/constants').DEFAULT_LOG_LEVEL;
var nInstances = 0;

/**
 * A {@link LocalTrackPublication} is a {@link LocalTrack} that has been
 * published to a {@link Room}.
 * @property {Track.Kind} kind - kind of the published {@link LocalTrack}
 * @property {LocalTrack} track - the {@link LocalTrack}
 * @property {string} trackName - the {@link LocalTrack}'s name
 * @property {Track.SID} trackSid - SID assigned to the published
 *   {@link LocalTrack}
 */

var LocalTrackPublication = function () {
  /**
   * Construct a {@link LocalTrackPublication}.
   * @param {Track.SID} sid - SID assigned to the published {@link LocalTrack}
   * @param {LocalTrack} track - the {@link LocalTrack}
   * @param {function(LocalTrackPublication): void} unpublish - The callback
   *   that unpublishes the {@link LocalTrackPublication}
   * @param {LocalTrackPublicationOptions} options - {@link LocalTrackPublication}
   *   options
   */
  function LocalTrackPublication(sid, track, unpublish, options) {
    _classCallCheck(this, LocalTrackPublication);

    options = Object.assign({
      logLevel: DEFAULT_LOG_LEVEL
    }, options);

    var logLevels = buildLogLevels(options.logLevel);

    Object.defineProperties(this, {
      _instanceId: {
        value: nInstances++
      },
      _log: {
        value: options.log || new Log('default', this, logLevels)
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
      },
      trackName: {
        enumerable: true,
        value: track.name
      },
      trackSid: {
        enumerable: true,
        value: sid
      }
    });
  }

  _createClass(LocalTrackPublication, [{
    key: 'toString',
    value: function toString() {
      return '[LocalTrackPublication #' + this._instanceId + ': ' + this.trackSid + ']';
    }

    /**
     * Unpublish a {@link LocalTrackPublication}. This means that the media
     * from this {@link LocalTrackPublication} is no longer available to the
     * {@link Room}'s {@link RemoteParticipant}s.
     * @returns {this}
     */

  }, {
    key: 'unpublish',
    value: function unpublish() {
      this._unpublish(this);
      return this;
    }
  }]);

  return LocalTrackPublication;
}();

/**
 * {@link LocalTrackPublication} options
 * @typedef {object} LocalTrackPublicationOptions
 * @property {LogLevel|LogLevels} logLevel - Log level for 'media' modules
 */

module.exports = LocalTrackPublication;