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
var TrackSignaling = require('./track');
/**
 * A {@link LocalTrackPublication} implementation
 * @extends TrackSignaling
 * @property {Track.ID} id
 */
var LocalTrackPublicationSignaling = /** @class */ (function (_super) {
    __extends(LocalTrackPublicationSignaling, _super);
    /**
     * Construct a {@link LocalTrackPublicationSignaling}. {@link TrackSenders}
     * are always cloned.
     * @param {DataTrackSender|MediaTrackSender} trackSender - the {@link TrackSender}
     *   of the {@link LocalTrack} to be published
     * @param {string} name - the name of the {@link LocalTrack} to be published
     * @param {Track.Priority} priority - initial {@link Track.Priority}
     */
    function LocalTrackPublicationSignaling(trackSender, name, priority) {
        var _this = this;
        trackSender = trackSender.clone();
        var enabled = trackSender.kind === 'data' ? true : trackSender.track.enabled;
        _this = _super.call(this, name, trackSender.kind, enabled, priority) || this;
        _this.setTrackTransceiver(trackSender);
        Object.defineProperties(_this, {
            _updatedPriority: {
                value: priority,
                writable: true
            },
            id: {
                enumerable: true,
                value: trackSender.id
            }
        });
        return _this;
    }
    Object.defineProperty(LocalTrackPublicationSignaling.prototype, "updatedPriority", {
        /**
         * The updated {@link Track.Priority} of the {@link LocalTrack}.
         * @property {Track.priority}
         */
        get: function () {
            return this._updatedPriority;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Enable (or disable) the {@link LocalTrackPublicationSignaling} if it is not
     * already enabled (or disabled). This also updates the cloned
     * {@link MediaTrackSender}'s MediaStreamTracks `enabled` state.
     * @param {boolean} [enabled=true]
     * @return {this}
     */
    LocalTrackPublicationSignaling.prototype.enable = function (enabled) {
        enabled = typeof enabled === 'boolean' ? enabled : true;
        this.trackTransceiver.track.enabled = enabled;
        return _super.prototype.enable.call(this, enabled);
    };
    /**
     * Rejects the SID's deferred promise with the given Error.
     * @param {Error} error
     * @returns {this}
     */
    LocalTrackPublicationSignaling.prototype.publishFailed = function (error) {
        if (setError(this, error)) {
            this.emit('updated');
        }
        return this;
    };
    /**
     * Update the {@link Track.Priority} of the published {@link LocalTrack}.
     * @param {Track.priority} priority
     * @returns {this}
     */
    LocalTrackPublicationSignaling.prototype.setPriority = function (priority) {
        if (this._updatedPriority !== priority) {
            this._updatedPriority = priority;
            this.emit('updated');
        }
        return this;
    };
    /**
     * Set the published {@link LocalTrack}'s {@link Track.SID}.
     * @param {Track.SID} sid
     * @returns {this}
     */
    LocalTrackPublicationSignaling.prototype.setSid = function (sid) {
        if (this._error) {
            return this;
        }
        return _super.prototype.setSid.call(this, sid);
    };
    /**
     * Stop the cloned {@link TrackSender}.
     * @returns {void}
     */
    LocalTrackPublicationSignaling.prototype.stop = function () {
        this.trackTransceiver.stop();
    };
    return LocalTrackPublicationSignaling;
}(TrackSignaling));
/**
 * @param {LocalTrackPublication} publication
 * @param {Error} error
 * @returns {boolean} updated
 */
function setError(publication, error) {
    if (publication._sid !== null || publication._error) {
        return false;
    }
    publication._error = error;
    return true;
}
module.exports = LocalTrackPublicationSignaling;
//# sourceMappingURL=localtrackpublication.js.map