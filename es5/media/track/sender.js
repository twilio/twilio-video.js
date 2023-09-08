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
var MediaTrackTransceiver = require('./transceiver');
/**
 * A {@link MediaTrackSender} represents one or more local RTCRtpSenders.
 * @extends MediaTrackTransceiver
 * @emits MediaTrackSender#replaced
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
            _eventsToReemitters: {
                value: new Map([
                    ['mute', function () { return _this.queue('muted'); }],
                    ['unmute', function () { return _this.queue('unmuted'); }]
                ])
            },
            _senders: {
                value: new Set()
            },
            _senderToPublisherHintCallbacks: {
                value: new Map()
            },
            isPublishing: {
                enumerable: true,
                get: function () {
                    return !!this._clones.size;
                }
            },
            muted: {
                enumerable: true,
                get: function () {
                    return this._track.muted;
                }
            }
        });
        _this._reemitMediaStreamTrackEvents();
        return _this;
    }
    /**
     * @private
     */
    MediaTrackSender.prototype._reemitMediaStreamTrackEvents = function (mediaStreamTrack) {
        if (mediaStreamTrack === void 0) { mediaStreamTrack = this._track; }
        var _a = this, eventsToReemitters = _a._eventsToReemitters, track = _a._track;
        eventsToReemitters.forEach(function (reemitter, event) { return mediaStreamTrack.addEventListener(event, reemitter); });
        if (track !== mediaStreamTrack) {
            eventsToReemitters.forEach(function (reemitter, event) { return track.removeEventListener(event, reemitter); });
            if (track.muted !== mediaStreamTrack.muted) {
                var reemitter = eventsToReemitters.get(mediaStreamTrack.muted ? 'mute' : 'unmute');
                reemitter();
            }
        }
    };
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
            return _this._replaceTrack(sender, mediaStreamTrack);
        }))).finally(function () {
            _this._reemitMediaStreamTrackEvents(mediaStreamTrack);
            _this._track = mediaStreamTrack;
        });
    };
    /**
     * Add an RTCRtpSender.
     * @param {RTCRtpSender} sender
     * @param {?()=>Promise<string>} publisherHintCallback
     * @returns {this}
     */
    MediaTrackSender.prototype.addSender = function (sender, publisherHintCallback) {
        this._senders.add(sender);
        if (publisherHintCallback) {
            this._senderToPublisherHintCallbacks.set(sender, publisherHintCallback);
        }
        return this;
    };
    /**
     * Remove an RTCRtpSender.
     * @param {RTCRtpSender} sender
     * @returns {this}
     */
    MediaTrackSender.prototype.removeSender = function (sender) {
        this._senders.delete(sender);
        this._senderToPublisherHintCallbacks.delete(sender);
        return this;
    };
    /**
     * Applies given encodings, or resets encodings if none specified.
     * @param {Array<{enabled: boolean, layer_index: number}>|null} encodings
     * @returns {Promise<string>}
     */
    MediaTrackSender.prototype.setPublisherHint = function (encodings) {
        // Note(mpatwardhan): since publisher hint applies only to group rooms we only look at 1st call callback.
        var _a = __read(Array.from(this._senderToPublisherHintCallbacks.values()), 1), publisherHintCallback = _a[0];
        return publisherHintCallback ? publisherHintCallback(encodings) : Promise.resolve('COULD_NOT_APPLY_HINT');
    };
    MediaTrackSender.prototype._replaceTrack = function (sender, mediaStreamTrack) {
        var _this = this;
        return sender.replaceTrack(mediaStreamTrack).then(function (replaceTrackResult) {
            // clear any publisherHints and apply default encodings.
            _this.setPublisherHint(null).catch(function () { });
            _this.emit('replaced');
            return replaceTrackResult;
        });
    };
    return MediaTrackSender;
}(MediaTrackTransceiver));
/**
 * The {@link MediaTrackSender}'s underlying MediaStreamTrack was muted.
 * @event MediaTrackSender#muted
 */
/**
 * The {@link MediaTrackSender} replaced the underlying MediaStreamTrack.
 * @event MediaTrackSender#replaced
 */
/**
 * The {@link MediaTrackSender}'s underlying MediaStreamTrack was unmuted.
 * @event MediaTrackSender#unmuted
 */
module.exports = MediaTrackSender;
//# sourceMappingURL=sender.js.map