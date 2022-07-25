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
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
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
 * @emits LocalTrackPublication#warning
 * @emits LocalTrackPublication#warningsCleared
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
            _reemitSignalingEvent: {
                value: function () {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i] = arguments[_i];
                    }
                    return _this.emit.apply(_this, __spreadArray([args && args.length ? 'warning' : 'warningsCleared'], __read(args)));
                }
            },
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
        ['disabled', 'enabled'].forEach(function (name) {
            return track.on(name, _this._reemitTrackEvent);
        });
        ['warning', 'warningsCleared'].forEach(function (name) {
            return signaling.on(name, _this._reemitSignalingEvent);
        });
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
        var _this = this;
        ['disabled', 'enabled'].forEach(function (name) {
            return _this.track.removeListener(name, _this._reemitTrackEvent);
        });
        ['warning', 'warningsCleared'].forEach(function (name) {
            return _this._signaling.removeListener(name, _this._reemitSignalingEvent);
        });
        this._unpublish(this);
        return this;
    };
    return LocalTrackPublication;
}(TrackPublication));
/**
 * The published {@link LocalTrack} encountered a warning.
 * This event is only raised if you enabled warnings using <code>notifyWarnings</code> in <code>ConnectOptions</code>.
 * @event LocalTrackPublication#warning
 * @param {string} name - The warning that was raised.
 */
/**
 * The published {@link LocalTrack} cleared all warnings.
 * This event is only raised if you enabled warnings using <code>notifyWarnings</code> in <code>ConnectOptions</code>.
 * @event LocalTrackPublication#warningsCleared
 */
module.exports = LocalTrackPublication;
//# sourceMappingURL=localtrackpublication.js.map