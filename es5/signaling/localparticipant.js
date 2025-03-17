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
var ParticipantSignaling = require('./participant');
var LocalParticipantSignaling = /** @class */ (function (_super) {
    __extends(LocalParticipantSignaling, _super);
    function LocalParticipantSignaling() {
        var _this = _super.call(this) || this;
        Object.defineProperties(_this, {
            _publicationsToTrackSenders: {
                value: new Map()
            },
            _trackSendersToPublications: {
                value: new Map()
            }
        });
        return _this;
    }
    /**
     * @param {DataTrackSender|MediaTrackSender} trackSender
     * @param {string} name
     * @param {Track.Priority} priority
     * @param {?NoiseCancellationVendor} noiseCancellationVendor
     * @returns {LocalTrackPublicationSignaling} publication
     */
    LocalParticipantSignaling.prototype.addTrack = function (trackSender, name, priority, noiseCancellationVendor) {
        if (noiseCancellationVendor === void 0) { noiseCancellationVendor = null; }
        var publication = this._createLocalTrackPublicationSignaling(trackSender, name, priority, noiseCancellationVendor);
        this._trackSendersToPublications.set(trackSender, publication);
        this._publicationsToTrackSenders.set(publication, trackSender);
        _super.prototype.addTrack.call(this, publication);
        return this;
    };
    /**
     * @param {DataTrackSender|MediaTrackSender} trackSender
     * @returns {?LocalTrackPublicationSignaling}
     */
    LocalParticipantSignaling.prototype.getPublication = function (trackSender) {
        return this._trackSendersToPublications.get(trackSender) || null;
    };
    /**
     * @param {LocalTrackPublicationSignaling} trackPublication
     * @returns {?DataTrackSender|MediaTrackSender}
     */
    LocalParticipantSignaling.prototype.getSender = function (trackPublication) {
        return this._publicationsToTrackSenders.get(trackPublication) || null;
    };
    /**
     * @param {DataTrackSender|MediaTrackSender} trackSender
     * @returns {?LocalTrackPublicationSignaling}
     */
    LocalParticipantSignaling.prototype.removeTrack = function (trackSender) {
        var publication = this._trackSendersToPublications.get(trackSender);
        if (!publication) {
            return null;
        }
        this._trackSendersToPublications.delete(trackSender);
        this._publicationsToTrackSenders.delete(publication);
        var didDelete = _super.prototype.removeTrack.call(this, publication);
        if (didDelete) {
            publication.stop();
        }
        return publication;
    };
    return LocalParticipantSignaling;
}(ParticipantSignaling));
module.exports = LocalParticipantSignaling;
//# sourceMappingURL=localparticipant.js.map