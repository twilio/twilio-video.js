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
var TwilioWarning = require('../../util/twiliowarning');
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
     * @param {?NoiseCancellationVendor} noiseCancellationVendor
     * @param {object} [options]
     */
    function LocalTrackPublicationV2(trackSender, name, priority, noiseCancellationVendor, options) {
        var _this = _super.call(this, trackSender, name, priority) || this;
        Object.defineProperties(_this, {
            _log: {
                value: options.log.createLog('default', _this)
            },
            _mediaStates: {
                value: { recordings: null },
                writable: true
            },
            _noiseCancellationVendor: {
                value: noiseCancellationVendor,
            }
        });
        return _this;
    }
    /**
     * Get the {@link LocalTrackPublicationV2#Representation} of a given {@link TrackSignaling}.
     * @returns {LocalTrackPublicationV2#Representation} - without the SID
     */
    LocalTrackPublicationV2.prototype.getState = function () {
        var state = {
            enabled: this.isEnabled,
            id: this.id,
            kind: this.kind,
            name: this.name,
            priority: this.updatedPriority,
        };
        if (this._noiseCancellationVendor) {
            // eslint-disable-next-line camelcase
            state.audio_processor = this._noiseCancellationVendor;
        }
        return state;
    };
    LocalTrackPublicationV2.prototype.toString = function () {
        return "[LocalTrackPublicationV2: " + this.sid + "]";
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
    LocalTrackPublicationV2.prototype.updateMediaStates = function (mediaStates) {
        if (!mediaStates || !mediaStates.recordings ||
            this._mediaStates.recordings === mediaStates.recordings) {
            return this;
        }
        this._mediaStates.recordings = mediaStates.recordings;
        switch (this._mediaStates.recordings) {
            case 'OK':
                this._log.info('Warnings have cleared.');
                this.emit('warningsCleared');
                break;
            case 'NO_MEDIA':
                this._log.warn('Recording media lost.');
                this.emit('warning', TwilioWarning.recordingMediaLost);
                break;
            default:
                this._log.warn("Unknown media state detected: " + this._mediaStates.recordings);
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