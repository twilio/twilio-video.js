'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var EventEmitter = require('../../eventemitter');
var _a = require('../../util'), buildLogLevels = _a.buildLogLevels, valueToJSON = _a.valueToJSON;
var DEFAULT_LOG_LEVEL = require('../../util/constants').DEFAULT_LOG_LEVEL;
var Log = require('../../util/log');
var nInstances = 0;
/**
 * A {@link Track} represents a stream of audio, video, or data.
 * @extends EventEmitter
 * @property {Track.Kind} kind - The {@link Track}'s kind
 * @property {string} name - The {@link Track}'s name
 */
var Track = /** @class */ (function (_super) {
    __extends(Track, _super);
    /**
     * Construct a {@link Track}.
     * @param {Track.ID} id - The {@link Track}'s ID
     * @param {Track.Kind} kind - The {@link Track}'s kind
     * @param {{ log: Log, name: ?string }} options
     */
    function Track(id, kind, options) {
        var _this = this;
        options = Object.assign({
            name: id,
            log: null,
            logLevel: DEFAULT_LOG_LEVEL
        }, options);
        _this = _super.call(this) || this;
        var name = String(options.name);
        var logLevels = buildLogLevels(options.logLevel);
        var log = options.log
            ? options.log.createLog('media', _this)
            : new Log('media', _this, logLevels, options.loggerName);
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
    Track.prototype.toJSON = function () {
        return valueToJSON(this);
    };
    return Track;
}(EventEmitter));
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
//# sourceMappingURL=index.js.map