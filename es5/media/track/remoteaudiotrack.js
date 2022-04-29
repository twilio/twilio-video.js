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
var AudioTrack = require('./audiotrack');
var mixinRemoteMediaTrack = require('./remotemediatrack');
var RemoteMediaAudioTrack = mixinRemoteMediaTrack(AudioTrack);
/**
 * A {@link RemoteAudioTrack} represents an {@link AudioTrack} published to a
 * {@link Room} by a {@link RemoteParticipant}.
 * @extends AudioTrack
 * @property {boolean} isEnabled - <code>Deprecated: Use (.switchOffReason !== "disabled-by-publisher") instead</code>
 *   Whether the {@link RemoteAudioTrack} is enabled
 * @property {boolean} isSwitchedOff - Whether the {@link RemoteAudioTrack} is switched off
 * @property {?TrackSwitchOffReason} switchOffReason - The reason for the {@link RemoteAudioTrack} being switched off;
 *   If switched on, it is set to <code>null</code>; The {@link RemoteAudioTrack} is initially switched off with this
 *   property set to <code>disabled-by-subscriber</code>
 * @property {Track.SID} sid - The {@link RemoteAudioTrack}'s SID
 * @property {?Track.Priority} priority - The subscribe priority of the {@link RemoteAudioTrack}
 * @emits RemoteAudioTrack#disabled
 * @emits RemoteAudioTrack#enabled
 * @emits RemoteAudioTrack#started
 * @emits RemoteAudioTrack#switchedOff
 * @emits RemoteAudioTrack#switchedOn
 */
var RemoteAudioTrack = /** @class */ (function (_super) {
    __extends(RemoteAudioTrack, _super);
    /**
     * Construct a {@link RemoteAudioTrack}.
     * @param {Track.SID} sid - The {@link RemoteAudioTrack}'s SID
     * @param {?MediaTrackReceiver} mediaTrackReceiver - An audio MediaStreamTrack container
     * @param {boolean} isEnabled - Whether the {@link RemoteAudioTrack} is enabled
     * @param {boolean} isSwitchedOff - Whether the {@link RemoteAudioTrack} is switched off
     * @param {?string} switchOffReason - The reason the {@link RemoteAudioTrack} is switched off
     * @param {function(?Track.Priority): void} setPriority - Set or clear the subscribe
     *  {@link Track.Priority} of the {@link RemoteAudioTrack}
     * @param {function(ClientRenderHint): void} setRenderHint - Set render hints.
     * @param {{log: Log, name: string}} options - The {@link RemoteTrack} options
     */
    function RemoteAudioTrack(sid, mediaTrackReceiver, isEnabled, isSwitchedOff, switchOffReason, setPriority, setRenderHint, options) {
        return _super.call(this, 'audio', sid, mediaTrackReceiver, isEnabled, isSwitchedOff, switchOffReason, setPriority, setRenderHint, options) || this;
    }
    RemoteAudioTrack.prototype.toString = function () {
        return "[RemoteAudioTrack #" + this._instanceId + ": " + this.sid + "]";
    };
    /**
     * Update the subscribe {@link Track.Priority} of the {@link RemoteAudioTrack}.
     * @param {?Track.Priority} priority - the new subscribe {@link Track.Priority};
     *   Currently setPriority has no effect on audio tracks.
     * @returns {this}
     * @throws {RangeError}
     */
    RemoteAudioTrack.prototype.setPriority = function (priority) {
        return _super.prototype.setPriority.call(this, priority);
    };
    return RemoteAudioTrack;
}(RemoteMediaAudioTrack));
/**
 * The {@link RemoteAudioTrack} was disabled, i.e. "muted".
 * @deprecated Use <a href="#event:switchedOff"><code>switchedOff</code></a> (<code>.switchOffReason === "disabled-by-publisher"</code>) instead
 * @param {RemoteAudioTrack} track - The {@link RemoteAudioTrack} that was
 *   disabled
 * @event RemoteAudioTrack#disabled
 */
/**
 * The {@link RemoteAudioTrack} was enabled, i.e. "unmuted".
 * @deprecated Use <a href="#event:switchedOn"><code>switchedOn</code></a> instead
 * @param {RemoteAudioTrack} track - The {@link RemoteAudioTrack} that was
 *   enabled
 * @event RemoteAudioTrack#enabled
 */
/**
 * The {@link RemoteAudioTrack} started. This means there is enough audio data
 * to begin playback.
 * @param {RemoteAudioTrack} track - The {@link RemoteAudioTrack} that started
 * @event RemoteAudioTrack#started
 */
/**
 * A {@link RemoteAudioTrack} was switched off. The media server stops sending media for the
 * {@link RemoteAudioTrack} until it is switched back on. Just before the event is raised,
 * <code>isSwitchedOff</code> is set to <code>true</code> and <code>switchOffReason</code> is
 * set to a {@link TrackSwitchOffReason}. Also, the <code>mediaStreamTrack</code> property is
 * set to <code>null</code>.
 * @param {RemoteAudioTrack} track - The {@link RemoteAudioTrack} that was
 *   switched off
 * @param {?TrackSwitchOffReason} switchOffReason - The reason the {@link RemoteAudioTrack}
 *   was switched off
 * @event RemoteAudioTrack#switchedOff
 */
/**
 * A {@link RemoteAudioTrack} was switched on. The media server starts sending media for the
 * {@link RemoteAudioTrack} until it is switched off. Just before the event is raised,
 * <code>isSwitchedOff</code> is set to <code>false</code> and <code>switchOffReason</code>
 * is set to <code>null</code>. Also, the <code>mediaStreamTrack</code> property is set to a
 * MediaStreamTrack that is the source of the {@link RemoteAudioTrack}'s media.
 * @param {RemoteAudioTrack} track - The {@link RemoteAudioTrack} that was
 *   switched on
 * @event RemoteAudioTrack#switchedOn
 */
module.exports = RemoteAudioTrack;
//# sourceMappingURL=remoteaudiotrack.js.map