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
var RemoteTrackPublicationSignaling = require('../remotetrackpublication');
/**
 * @extends RemoteTrackPublicationSignaling
 */
var RemoteTrackPublicationV2 = /** @class */ (function (_super) {
    __extends(RemoteTrackPublicationV2, _super);
    /**
     * Construct a {@link RemoteTrackPublicationV2}.
     * @param {RemoteTrackPublicationV2#Representation} track
     * @param {boolean} isSwitchedOff
     *
     */
    function RemoteTrackPublicationV2(track, isSwitchedOff) {
        return _super.call(this, track.sid, track.name, track.kind, track.enabled, track.priority, isSwitchedOff) || this;
    }
    /**
     * Compare the {@link RemoteTrackPublicationV2} to a
     * {@link RemoteTrackPublicationV2#Representation} of itself and perform any
     * updates necessary.
     * @param {RemoteTrackPublicationV2#Representation} track
     * @returns {this}
     * @fires TrackSignaling#updated
     */
    RemoteTrackPublicationV2.prototype.update = function (track) {
        this.enable(track.enabled);
        this.setPriority(track.priority);
        return this;
    };
    return RemoteTrackPublicationV2;
}(RemoteTrackPublicationSignaling));
/**
 * The Room Signaling Protocol (RSP) representation of a {@link RemoteTrackPublicationV2}.
 * @typedef {LocalTrackPublicationV2#Representation} RemoteTrackPublicationV2#Representation
 * @property {boolean} subscribed
 */
module.exports = RemoteTrackPublicationV2;
//# sourceMappingURL=remotetrackpublication.js.map