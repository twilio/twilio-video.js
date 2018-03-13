'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var buildLogLevels = require('../../util').buildLogLevels;
var Log = require('../../util/log');
var DEFAULT_LOG_LEVEL = require('../../util/constants').DEFAULT_LOG_LEVEL;
var nInstances = 0;

/**
 * A {@link RemoteTrackPublication} represents a {@link RemoteTrack} that has
 * been published to a {@link Room}.
 * @property {Track.Kind} kind - kind of the published {@link RemoteTrack}
 * @property {?RemoteTrack} track - unless you have subscribed to the
 *   {@link RemoteTrack}, this property is null
 * @property {string} trackName - the {@link RemoteTrack}'s name
 * @property {Track.SID} trackSid - the {@link RemoteTrack}'s SID
 */

var RemoteTrackPublication = function () {
  /**
   * Construct a {@link RemoteTrackPublication}.
   * @param {Track.Kind} kind - the {@link RemoteTrack}'s kind
   * @param {Track.SID} trackSid - the {@link RemoteTrack}'s SID
   * @param {string} trackName - the {@link RemoteTrack}'s name
   * @param {RemoteTrackPublicationOptions} options - {@link RemoteTrackPublication}
   *   options
   */
  function RemoteTrackPublication(kind, trackSid, trackName, options) {
    _classCallCheck(this, RemoteTrackPublication);

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
      kind: {
        enumerable: true,
        value: kind
      },
      track: {
        enumerable: true,
        value: null
      },
      trackName: {
        enumerable: true,
        value: trackName
      },
      trackSid: {
        enumerable: true,
        value: trackSid
      }
    });
  }

  _createClass(RemoteTrackPublication, [{
    key: 'toString',
    value: function toString() {
      return '[RemoteTrackPublication #' + this._instanceId + ': ' + this.trackSid + ']';
    }
  }]);

  return RemoteTrackPublication;
}();

/**
/**
 * {@link RemoteTrackPublication} options
 * @typedef {object} RemoteTrackPublicationOptions
 * @property {LogLevel|LogLevels} logLevel - Log level for 'media' modules
 */

module.exports = RemoteTrackPublication;