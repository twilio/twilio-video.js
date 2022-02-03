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
var LocalTrackPublicationSignaling = require('../localtrackpublication');
var createTwilioError = require('../../util/twilio-video-errors').createTwilioError;
/**
 * @extends LocalTrackPublicationSignaling
 */
var LocalTrackPublicationV2 = /** @class */ (function (_super) {
    __extends(LocalTrackPublicationV2, _super);
    /**
     * Construct a {@link LocalTrackPublicationV2}.
     * @param {DataTrackSender|MediaTrackSender} trackSender
     * @param {string} name
     * @param {Track.Priority} priority
     */
    function LocalTrackPublicationV2(trackSender, name, priority) {
        return _super.call(this, trackSender, name, priority) || this;
    }
    /**
     * Get the {@link LocalTrackPublicationV2#Representation} of a given {@link TrackSignaling}.
     * @returns {LocalTrackPublicationV2#Representation} - without the SID
     */
    LocalTrackPublicationV2.prototype.getState = function () {
        return {
            enabled: this.isEnabled,
            id: this.id,
            kind: this.kind,
            name: this.name,
            priority: this.updatedPriority
        };
    };
    /**
     * Compare the {@link LocalTrackPublicationV2} to a {@link LocalTrackPublicationV2#Representation} of itself
     * and perform any updates necessary.
     * @param {PublishedTrack} track
     * @returns {this}
     * @fires TrackSignaling#updated
     */
    LocalTrackPublicationV2.prototype.update = function (track) {
        switch (track.state) {
            case 'ready':
                this.setSid(track.sid);
                break;
            case 'failed': {
                var error = track.error;
                this.publishFailed(createTwilioError(error.code, error.message));
                break;
            }
            default: // 'created'
                break;
        }
        return this;
    };
    return LocalTrackPublicationV2;
}(LocalTrackPublicationSignaling));
/**
 * The Room Signaling Protocol (RSP) representation of a {@link LocalTrackPublicationV2}.
 * @typedef {object} LocalTrackPublicationV2#Representation
 * @property {boolean} enabled
 * @property {Track.ID} id
 * @property {Track.Kind} kind
 * @property {string} name
 * @priority {Track.Priority} priority
 * @property {Track.SID} sid
 */
module.exports = LocalTrackPublicationV2;
//# sourceMappingURL=localtrackpublication.js.map