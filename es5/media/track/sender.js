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
var MediaTrackTransceiver = require('./transceiver');
/**
 * A {@link MediaTrackSender} represents one or more local RTCRtpSenders.
 * @extends MediaTrackTransceiver
 */
var MediaTrackSender = /** @class */ (function (_super) {
    __extends(MediaTrackSender, _super);
    /**
     * Construct a {@link MediaTrackSender}.
     * @param {MediaStreamTrack} mediaStreamTrack
     */
    function MediaTrackSender(mediaStreamTrack) {
        var _this = _super.call(this, mediaStreamTrack.id, mediaStreamTrack) || this;
        Object.defineProperties(_this, {
            _clones: {
                value: new Set()
            },
            _senders: {
                value: new Set()
            },
            isPublishing: {
                get: function () {
                    return !!this._clones.size;
                }
            }
        });
        return _this;
    }
    /**
     * Return a new {@link MediaTrackSender} containing a clone of the underlying
     * MediaStreamTrack. No RTCRtpSenders are copied.
     * @returns {MediaTrackSender}
     */
    MediaTrackSender.prototype.clone = function () {
        var clone = new MediaTrackSender(this.track.clone());
        this._clones.add(clone);
        return clone;
    };
    /**
     * Remove a cloned {@link MediaTrackSender}.
     * @returns {void}
     */
    MediaTrackSender.prototype.removeClone = function (clone) {
        this._clones.delete(clone);
    };
    /**
     * Set the given MediaStreamTrack.
     * @param {MediaStreamTrack} mediaStreamTrack
     * @returns {Promise<void>}
     */
    MediaTrackSender.prototype.setMediaStreamTrack = function (mediaStreamTrack) {
        var _this = this;
        var clones = Array.from(this._clones);
        var senders = Array.from(this._senders);
        return Promise.all(clones.map(function (clone) {
            return clone.setMediaStreamTrack(mediaStreamTrack.clone());
        }).concat(senders.map(function (sender) {
            return sender.replaceTrack(mediaStreamTrack);
        }))).finally(function () {
            _this._track = mediaStreamTrack;
        });
    };
    /**
     * Add an RTCRtpSender.
     * @param {RTCRtpSender} sender
     * @returns {this}
     */
    MediaTrackSender.prototype.addSender = function (sender) {
        this._senders.add(sender);
        return this;
    };
    /**
     * Remove an RTCRtpSender.
     * @param {RTCRtpSender} sender
     * @returns {this}
     */
    MediaTrackSender.prototype.removeSender = function (sender) {
        this._senders.delete(sender);
        return this;
    };
    return MediaTrackSender;
}(MediaTrackTransceiver));
module.exports = MediaTrackSender;
//# sourceMappingURL=sender.js.map