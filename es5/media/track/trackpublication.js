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
var valueToJSON = require('../../util').valueToJSON;
var DEFAULT_LOGGER_NAME = require('../../util/constants').DEFAULT_LOGGER_NAME;
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
var TrackPublication = /** @class */ (function (_super) {
    __extends(TrackPublication, _super);
    /**
     * Construct a {@link TrackPublication}.
     * @param {string} trackName - the published {@link Track}'s name
     * @param {Track.SID} trackSid - SID assigned to the {@link Track}
     * @param {TrackPublicationOptions} options - {@link TrackPublication} options
     */
    function TrackPublication(trackName, trackSid, options) {
        var _this = _super.call(this) || this;
        options = Object.assign({
            log: null,
            loggerName: DEFAULT_LOGGER_NAME
        }, options);
        Object.defineProperties(_this, {
            _instanceId: {
                value: nInstances++
            },
            _log: {
                value: options.log ? options.log.createLog(_this) : new Log(_this, options.loggerName)
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
    TrackPublication.prototype.toJSON = function () {
        return valueToJSON(this);
    };
    TrackPublication.prototype.toString = function () {
        return "[TrackPublication #" + this._instanceId + ": " + this.trackSid + "]";
    };
    return TrackPublication;
}(EventEmitter));
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
 */
module.exports = TrackPublication;
//# sourceMappingURL=trackpublication.js.map