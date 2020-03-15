'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var EventEmitter = require('../../eventemitter');

var _require = require('../../util'),
    buildLogLevels = _require.buildLogLevels,
    valueToJSON = _require.valueToJSON;

var DEFAULT_LOG_LEVEL = require('../../util/constants').DEFAULT_LOG_LEVEL;
var Log = require('../../util/log');

var nInstances = 0;

/**
 * A {@link Track} represents a stream of audio, video, or data.
 * @extends EventEmitter
 * @property {Track.Kind} kind - The {@link Track}'s kind
 * @property {string} name - The {@link Track}'s name
 */

var Track = function (_EventEmitter) {
  _inherits(Track, _EventEmitter);

  /**
   * Construct a {@link Track}.
   * @param {Track.ID} id - The {@link Track}'s ID
   * @param {Track.Kind} kind - The {@link Track}'s kind
   * @param {{ log: Log, name: ?string }} options
   */
  function Track(id, kind, options) {
    _classCallCheck(this, Track);

    options = Object.assign({
      name: id,
      log: null,
      logLevel: DEFAULT_LOG_LEVEL
    }, options);

    var _this = _possibleConstructorReturn(this, (Track.__proto__ || Object.getPrototypeOf(Track)).call(this));

    var name = String(options.name);

    var logLevels = buildLogLevels(options.logLevel);
    var log = options.log ? options.log.createLog('media', _this) : new Log('media', _this, logLevels);

    Object.defineProperties(_this, {
      _instanceId: {
        value: ++nInstances
      },
      _log: {
        value: log
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

  _createClass(Track, [{
    key: 'toJSON',
    value: function toJSON() {
      return valueToJSON(this);
    }
  }]);

  return Track;
}(EventEmitter);

/**
 * The {@link Track} ID is a string identifier for the {@link Track}.
 * @typedef {string} Track.ID
 */

/**
 * The {@link Track} kind is either "audio", "video", or "data".
 * @typedef {string} Track.Kind
 */

/**
 * The {@link Track}'s priority can be "low", "standard", or "high".
 * @typedef {string} Track.Priority
 */

/**
 * The {@link Track} SID is a unique string identifier for the {@link Track}
 * that is published to a {@link Room}.
 * @typedef {string} Track.SID
 */

/**
 * A {@link DataTrack} is a {@link LocalDataTrack} or {@link RemoteDataTrack}.
 * @typedef {LocalDataTrack|RemoteDataTrack} DataTrack
 */

/**
 * A {@link LocalTrack} is a {@link LocalAudioTrack}, {@link LocalVideoTrack},
 * or {@link LocalDataTrack}.
 * @typedef {LocalAudioTrack|LocalVideoTrack|LocalDataTrack} LocalTrack
 */

/**
 * {@link LocalTrack} options
 * @typedef {object} LocalTrackOptions
 * @property {LogLevel|LogLevels} logLevel - Log level for 'media' modules
 * @property {string} [name] - The {@link LocalTrack}'s name; by default,
 *   it is set to the {@link LocalTrack}'s ID.
 */

/**
 * A {@link RemoteTrack} is a {@link RemoteAudioTrack},
 * {@link RemoteVideoTrack}, or {@link RemoteDataTrack}.
 * @typedef {RemoteAudioTrack|RemoteVideoTrack|RemoteDataTrack} RemoteTrack
 */

module.exports = Track;