'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var EventEmitter = require('../../eventemitter');

var _require = require('../../util'),
    buildLogLevels = _require.buildLogLevels,
    valueToJSON = _require.valueToJSON;

var _require2 = require('../../util/constants'),
    DEFAULT_LOG_LEVEL = _require2.DEFAULT_LOG_LEVEL;

var Log = require('../../util/log');
var nInstances = 0;

/**
 * A {@link TrackPublication} represents a {@link Track} that
 * has been published to a {@link Room}.
 * @property {string} trackName - the published {@link Track}'s name
 * @property {Track.SID} trackSid - SID assigned to the published {@link Track}
 * @emits TrackPublication#trackDisabled
 * @emits TrackPublication#trackEnabled
 */

var TrackPublication = function (_EventEmitter) {
  _inherits(TrackPublication, _EventEmitter);

  /**
   * Construct a {@link TrackPublication}.
   * @param {string} trackName - the published {@link Track}'s name
   * @param {Track.SID} trackSid - SID assigned to the {@link Track}
   * @param {TrackPublicationOptions} options - {@link TrackPublication} options
   */
  function TrackPublication(trackName, trackSid, options) {
    _classCallCheck(this, TrackPublication);

    var _this = _possibleConstructorReturn(this, (TrackPublication.__proto__ || Object.getPrototypeOf(TrackPublication)).call(this));

    options = Object.assign({
      logLevel: DEFAULT_LOG_LEVEL
    }, options);

    var logLevels = buildLogLevels(options.logLevel);

    Object.defineProperties(_this, {
      _instanceId: {
        value: nInstances++
      },
      _log: {
        value: options.log || new Log('default', _this, logLevels, options.loggerName)
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
    return _this;
  }

  _createClass(TrackPublication, [{
    key: 'toJSON',
    value: function toJSON() {
      return valueToJSON(this);
    }
  }, {
    key: 'toString',
    value: function toString() {
      return '[TrackPublication #' + this._instanceId + ': ' + this.trackSid + ']';
    }
  }]);

  return TrackPublication;
}(EventEmitter);

/**
 * The published {@link Track} was disabled.
 * @event TrackPublication#trackDisabled
 */

/**
 * The published {@link Track} was enabled.
 * @event TrackPublication#trackEnabled
 */

/**
 * A {@link LocalAudioTrackPublication} or a {@link RemoteAudioTrackPublication}.
 * @typedef {LocalAudioTrackPublication|RemoteAudioTrackPublication} AudioTrackPublication
 */

/**
 * A {@link LocalDataTrackPublication} or a {@link RemoteDataTrackPublication}.
 * @typedef {LocalDataTrackPublication|RemoteDataTrackPublication} DataTrackPublication
 */

/**
 * A {@link LocalVideoTrackPublication} or a {@link RemoteVideoTrackPublication}.
 * @typedef {LocalVideoTrackPublication|RemoteVideoTrackPublication} VideoTrackPublication
 */

/**
 * {@link TrackPublication} options
 * @typedef {object} TrackPublicationOptions
 * @property {LogLevel|LogLevels} logLevel - Log level for 'media' modules
 */

module.exports = TrackPublication;