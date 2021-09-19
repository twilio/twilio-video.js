/* eslint new-cap:0 */
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
var TrackPublication = require('./trackpublication');
var _a = require('../../util/constants'), E = _a.typeErrors, trackPriority = _a.trackPriority;
/**
 * A {@link LocalTrackPublication} is a {@link LocalTrack} that has been
 * published to a {@link Room}.
 * @extends TrackPublication
 * @property {boolean} isTrackEnabled - whether the published {@link LocalTrack}
 *   is enabled
 * @property {Track.Kind} kind - kind of the published {@link LocalTrack}
 * @property {Track.Priority} priority - the publish priority of the {@link LocalTrack}
 * @property {LocalTrack} track - the {@link LocalTrack}
 */
var LocalTrackPublication = /** @class */ (function (_super) {
    __extends(LocalTrackPublication, _super);
    /**
     * Construct a {@link LocalTrackPublication}.
     * @param {LocalTrackPublicationSignaling} signaling - The corresponding
     *   {@link LocalTrackPublicationSignaling}
     * @param {LocalTrack} track - The {@link LocalTrack}
     * @param {function(LocalTrackPublication): void} unpublish - The callback
     *   that unpublishes the {@link LocalTrackPublication}
     * @param {TrackPublicationOptions} options - {@link LocalTrackPublication}
     *   options
     */
    function LocalTrackPublication(signaling, track, unpublish, options) {
        var _this = _super.call(this, track.name, signaling.sid, options) || this;
        Object.defineProperties(_this, {
            _reemitTrackEvent: {
                value: function () { return _this.emit(_this.isTrackEnabled
                    ? 'trackEnabled'
                    : 'trackDisabled'); }
            },
            _signaling: {
                value: signaling
            },
            _unpublish: {
                value: unpublish
            },
            isTrackEnabled: {
                enumerable: true,
                get: function () {
                    return this.track.kind === 'data' ? true : this.track.isEnabled;
                }
            },
            kind: {
                enumerable: true,
                value: track.kind
            },
            priority: {
                enumerable: true,
                get: function () {
                    return signaling.updatedPriority;
                }
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
    LocalTrackPublication.prototype.toString = function () {
        return "[LocalTrackPublication #" + this._instanceId + ": " + this.trackSid + "]";
    };
    /**
     * Update the {@link Track.Priority} of the published {@link LocalTrack}.
     * @param {Track.Priority} priority - the new {@link Track.priority}
     * @returns {this}
     * @throws {RangeError}
     */
    LocalTrackPublication.prototype.setPriority = function (priority) {
        var priorityValues = Object.values(trackPriority);
        if (!priorityValues.includes(priority)) {
            throw E.INVALID_VALUE('priority', priorityValues);
        }
        this._signaling.setPriority(priority);
        return this;
    };
    /**
     * Unpublish a {@link LocalTrackPublication}. This means that the media
     * from this {@link LocalTrackPublication} is no longer available to the
     * {@link Room}'s {@link RemoteParticipant}s.
     * @returns {this}
     */
    LocalTrackPublication.prototype.unpublish = function () {
        this.track.removeListener('disabled', this._reemitTrackEvent);
        this.track.removeListener('enabled', this._reemitTrackEvent);
        this._unpublish(this);
        return this;
    };
    return LocalTrackPublication;
}(TrackPublication));
module.exports = LocalTrackPublication;
//# sourceMappingURL=localtrackpublication.js.map