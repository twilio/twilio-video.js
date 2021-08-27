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
var LocalParticipantSignaling = require('../localparticipant');
var LocalTrackPublicationV2 = require('./localtrackpublication');
var isDeepEqual = require('../../util').isDeepEqual;
/**
 * @extends ParticipantSignaling
 * @property {BandwidthProfileOptions} bandwidthProfile
 * @property {NetworkQualityConfigurationImpl} networkQualityConfiguration
 * @property {number} revision
 * @emits LocalParticipantV2#updated
 */
var LocalParticipantV2 = /** @class */ (function (_super) {
    __extends(LocalParticipantV2, _super);
    /**
     * Construct a {@link LocalParticipantV2}.
     * @param {EncodingParametersImpl} encodingParameters
     * @param {NetworkQualityConfigurationImpl} networkQualityConfiguration
     * @param {object} [options]
     */
    function LocalParticipantV2(encodingParameters, networkQualityConfiguration, options) {
        var _this = this;
        options = Object.assign({
            LocalTrackPublicationV2: LocalTrackPublicationV2
        }, options);
        _this = _super.call(this) || this;
        Object.defineProperties(_this, {
            _bandwidthProfile: {
                value: null,
                writable: true
            },
            _bandwidthProfileRevision: {
                value: 0,
                writable: true
            },
            _encodingParameters: {
                value: encodingParameters
            },
            _removeListeners: {
                value: new Map()
            },
            _LocalTrackPublicationV2: {
                value: options.LocalTrackPublicationV2
            },
            _publishedRevision: {
                writable: true,
                value: 0
            },
            _revision: {
                writable: true,
                value: 1
            },
            _signalingRegion: {
                value: null,
                writable: true
            },
            bandwidthProfile: {
                enumerable: true,
                get: function () {
                    return this._bandwidthProfile;
                }
            },
            bandwidthProfileRevision: {
                enumerable: true,
                get: function () {
                    return this._bandwidthProfileRevision;
                }
            },
            networkQualityConfiguration: {
                enumerable: true,
                value: networkQualityConfiguration
            },
            revision: {
                enumerable: true,
                get: function () {
                    return this._revision;
                }
            },
            signalingRegion: {
                enumerable: true,
                get: function () {
                    return this._signalingRegion;
                }
            }
        });
        return _this;
    }
    /**
     * Set the signalingRegion.
     * @param {string} signalingRegion.
     */
    LocalParticipantV2.prototype.setSignalingRegion = function (signalingRegion) {
        if (!this._signalingRegion) {
            this._signalingRegion = signalingRegion;
        }
    };
    /**
     * Update the {@link BandwidthProfileOptions}.
     * @param {BandwidthProfileOptions} bandwidthProfile
     */
    LocalParticipantV2.prototype.setBandwidthProfile = function (bandwidthProfile) {
        if (!isDeepEqual(this._bandwidthProfile, bandwidthProfile)) {
            // NOTE(mmalavalli): Object.assign() copies the values of only
            // the top level properties. In order to deep copy the object, we
            // stringify and parse the object.
            this._bandwidthProfile = JSON.parse(JSON.stringify(bandwidthProfile));
            this._bandwidthProfileRevision++;
            this.didUpdate();
        }
    };
    /**
     * Set the {@link EncodingParameters}.
     * @param {?EncodingParameters} encodingParameters
     * @returns {this}
     */
    LocalParticipantV2.prototype.setParameters = function (encodingParameters) {
        this._encodingParameters.update(encodingParameters);
        return this;
    };
    /**
     * Update the {@link LocalParticipantV2} with the new state.
     * @param {Published} published
     * @returns {this}
     */
    LocalParticipantV2.prototype.update = function (published) {
        if (this._publishedRevision >= published.revision) {
            return this;
        }
        this._publishedRevision = published.revision;
        published.tracks.forEach(function (publicationState) {
            var localTrackPublicationV2 = this.tracks.get(publicationState.id);
            if (localTrackPublicationV2) {
                localTrackPublicationV2.update(publicationState);
            }
        }, this);
        return this;
    };
    /**
     * @protected
     * @param {DataTrackSender|MediaTrackSender} trackSender
     * @param {string} name
     * @param {Track.Priority} priority
     * @returns {LocalTrackPublicationV2}
     */
    LocalParticipantV2.prototype._createLocalTrackPublicationSignaling = function (trackSender, name, priority) {
        return new this._LocalTrackPublicationV2(trackSender, name, priority);
    };
    /**
     * Add a {@link LocalTrackPublicationV2} for the given {@link DataTrackSender}
     * or {@link MediaTrackSender} to the {@link LocalParticipantV2}.
     * @param {DataTrackSender|MediaTrackSender} trackSender
     * @param {string} name
     * @param {Track.Priority} priority
     * @returns {this}
     */
    LocalParticipantV2.prototype.addTrack = function (trackSender, name, priority) {
        var _this = this;
        _super.prototype.addTrack.call(this, trackSender, name, priority);
        var publication = this.getPublication(trackSender);
        var isEnabled = publication.isEnabled, updatedPriority = publication.updatedPriority;
        var updated = function () {
            // NOTE(mmalavalli): The LocalParticipantV2's state is only published if
            // the "updated" event is emitted due to LocalTrackPublicationV2's
            // .isEnabled or .updatedPriority being changed. We do not publish if it is fired due to the
            // LocalTrackPublicationV2's .sid being set.
            if (isEnabled !== publication.isEnabled || updatedPriority !== publication.updatedPriority) {
                _this.didUpdate();
                isEnabled = publication.isEnabled;
                updatedPriority = publication.updatedPriority;
            }
        };
        publication.on('updated', updated);
        this._removeListener(publication);
        this._removeListeners.set(publication, function () { return publication.removeListener('updated', updated); });
        this.didUpdate();
        return this;
    };
    /**
     * @private
     * @param {LocalTrackPublicationV2} publication
     * @returns {void}
     */
    LocalParticipantV2.prototype._removeListener = function (publication) {
        var removeListener = this._removeListeners.get(publication);
        if (removeListener) {
            removeListener();
        }
    };
    /**
     * Get the current state of the {@link LocalParticipantV2}.
     * @returns {object}
     */
    LocalParticipantV2.prototype.getState = function () {
        return {
            revision: this.revision,
            tracks: Array.from(this.tracks.values()).map(function (track) { return track.getState(); })
        };
    };
    /**
     * Increment the revision for the {@link LocalParticipantV2}.
     * @private
     * @returns {void}
     */
    LocalParticipantV2.prototype.didUpdate = function () {
        this._revision++;
        this.emit('updated');
    };
    /**
     * Remove the {@link LocalTrackPublicationV2} for the given {@link DataTrackSender}
     * or {@link MediaTrackSender} from the {@link LocalParticipantV2}.
     * @param {DataTrackSender|MediaTrackSender} trackSender
     * @returns {?LocalTrackPublicationV2}
     */
    LocalParticipantV2.prototype.removeTrack = function (trackSender) {
        var publication = _super.prototype.removeTrack.call(this, trackSender);
        if (publication) {
            trackSender.removeClone(publication.trackTransceiver);
            this._removeListener(publication);
            this.didUpdate();
        }
        return publication;
    };
    /**
     * Updates the verbosity of network quality information.
     * @param {NetworkQualityConfiguration} networkQualityConfiguration
     * @returns {void}
     */
    LocalParticipantV2.prototype.setNetworkQualityConfiguration = function (networkQualityConfiguration) {
        this.networkQualityConfiguration.update(networkQualityConfiguration);
    };
    return LocalParticipantV2;
}(LocalParticipantSignaling));
/**
 * @interface Published
 * @property {number} revision
 * @property {Array<PublishedTrack>} tracks
 */
/**
 * @typedef {CreatedTrack|ReadyTrack|FailedTrack} PublishedTrack
 */
/**
 * @interface CreatedTrack
 * @property {Track.ID} id
 * @property {string} state - "created"
 */
/**
 * @interface ReadyTrack
 * @property {Track.ID} id
 * @property {Track.SID} sid
 * @property {string} state - "ready"
 */
/**
 * @interface FailedTrack
 * @property {Track.ID} id
 * @property {TrackError} error
 * @property {string} state - "failed"
 */
/**
 * @interface TrackError
 * @property {number} code
 * @property {string} message
 */
/**
 * @event LocalParticipantV2#updated
 */
module.exports = LocalParticipantV2;
//# sourceMappingURL=localparticipant.js.map