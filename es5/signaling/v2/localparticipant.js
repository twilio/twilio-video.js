'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var LocalParticipantSignaling = require('../localparticipant');
var LocalTrackPublicationV2 = require('./localtrackpublication');

var _require = require('../../util'),
    isDeepEqual = _require.isDeepEqual;

/**
 * @extends ParticipantSignaling
 * @property {BandwidthProfileOptions} bandwidthProfile
 * @property {NetworkQualityConfigurationImpl} networkQualityConfiguration
 * @property {number} revision
 * @emits LocalParticipantV2#updated
 */


var LocalParticipantV2 = function (_LocalParticipantSign) {
  _inherits(LocalParticipantV2, _LocalParticipantSign);

  /**
   * Construct a {@link LocalParticipantV2}.
   * @param {EncodingParametersImpl} encodingParameters
   * @param {NetworkQualityConfigurationImpl} networkQualityConfiguration
   * @param {object} [options]
   */
  function LocalParticipantV2(encodingParameters, networkQualityConfiguration, options) {
    _classCallCheck(this, LocalParticipantV2);

    options = Object.assign({
      LocalTrackPublicationV2: LocalTrackPublicationV2
    }, options);

    var _this = _possibleConstructorReturn(this, (LocalParticipantV2.__proto__ || Object.getPrototypeOf(LocalParticipantV2)).call(this));

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
      bandwidthProfile: {
        enumerable: true,
        get: function get() {
          return this._bandwidthProfile;
        }
      },
      bandwidthProfileRevision: {
        enumerable: true,
        get: function get() {
          return this._bandwidthProfileRevision;
        }
      },
      networkQualityConfiguration: {
        enumerable: true,
        value: networkQualityConfiguration
      },
      revision: {
        enumerable: true,
        get: function get() {
          return this._revision;
        }
      }
    });
    return _this;
  }

  /**
   * Update the {@link BandwidthProfileOptions}.
   * @param {BandwidthProfileOptions} bandwidthProfile
   */


  _createClass(LocalParticipantV2, [{
    key: 'setBandwidthProfile',
    value: function setBandwidthProfile(bandwidthProfile) {
      if (!isDeepEqual(this._bandwidthProfile, bandwidthProfile)) {
        // NOTE(mmalavalli): Object.assign() copies the values of only
        // the top level properties. In order to deep copy the object, we
        // stringify and parse the object.
        this._bandwidthProfile = JSON.parse(JSON.stringify(bandwidthProfile));
        this._bandwidthProfileRevision++;
        this.didUpdate();
      }
    }

    /**
     * Set the {@link EncodingParameters}.
     * @param {?EncodingParameters} encodingParameters
     * @returns {this}
     */

  }, {
    key: 'setParameters',
    value: function setParameters(encodingParameters) {
      this._encodingParameters.update(encodingParameters);
      return this;
    }

    /**
     * Update the {@link LocalParticipantV2} with the new state.
     * @param {Published} published
     * @returns {this}
     */

  }, {
    key: 'update',
    value: function update(published) {
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
    }

    /**
     * @protected
     * @param {DataTrackSender|MediaTrackSender} trackSender
     * @param {string} name
     * @param {Track.Priority} priority
     * @returns {LocalTrackPublicationV2}
     */

  }, {
    key: '_createLocalTrackPublicationSignaling',
    value: function _createLocalTrackPublicationSignaling(trackSender, name, priority) {
      return new this._LocalTrackPublicationV2(trackSender, name, priority);
    }

    /**
     * Add a {@link LocalTrackPublicationV2} for the given {@link DataTrackSender}
     * or {@link MediaTrackSender} to the {@link LocalParticipantV2}.
     * @param {DataTrackSender|MediaTrackSender} trackSender
     * @param {string} name
     * @param {Track.Priority} priority
     * @returns {this}
     */

  }, {
    key: 'addTrack',
    value: function addTrack(trackSender, name, priority) {
      var _this2 = this;

      _get(LocalParticipantV2.prototype.__proto__ || Object.getPrototypeOf(LocalParticipantV2.prototype), 'addTrack', this).call(this, trackSender, name, priority);
      var publication = this.getPublication(trackSender);

      var isEnabled = publication.isEnabled,
          updatedPriority = publication.updatedPriority;


      var updated = function updated() {
        // NOTE(mmalavalli): The LocalParticipantV2's state is only published if
        // the "updated" event is emitted due to LocalTrackPublicationV2's
        // .isEnabled or .updatedPriority being changed. We do not publish if it is fired due to the
        // LocalTrackPublicationV2's .sid being set.
        if (isEnabled !== publication.isEnabled || updatedPriority !== publication.updatedPriority) {
          _this2.didUpdate();
          isEnabled = publication.isEnabled;
          updatedPriority = publication.updatedPriority;
        }
      };

      publication.on('updated', updated);

      this._removeListener(publication);
      this._removeListeners.set(publication, function () {
        return publication.removeListener('updated', updated);
      });

      this.didUpdate();

      return this;
    }

    /**
     * @private
     * @param {LocalTrackPublicationV2} publication
     * @returns {void}
     */

  }, {
    key: '_removeListener',
    value: function _removeListener(publication) {
      var removeListener = this._removeListeners.get(publication);
      if (removeListener) {
        removeListener();
      }
    }

    /**
     * Get the current state of the {@link LocalParticipantV2}.
     * @returns {object}
     */

  }, {
    key: 'getState',
    value: function getState() {
      return {
        revision: this.revision,
        tracks: Array.from(this.tracks.values()).map(function (track) {
          return track.getState();
        })
      };
    }

    /**
     * Increment the revision for the {@link LocalParticipantV2}.
     * @private
     * @returns {void}
     */

  }, {
    key: 'didUpdate',
    value: function didUpdate() {
      this._revision++;
      this.emit('updated');
    }

    /**
     * Remove the {@link LocalTrackPublicationV2} for the given {@link DataTrackSender}
     * or {@link MediaTrackSender} from the {@link LocalParticipantV2}.
     * @param {DataTrackSender|MediaTrackSender} trackSender
     * @returns {?LocalTrackPublicationV2}
     */

  }, {
    key: 'removeTrack',
    value: function removeTrack(trackSender) {
      var publication = _get(LocalParticipantV2.prototype.__proto__ || Object.getPrototypeOf(LocalParticipantV2.prototype), 'removeTrack', this).call(this, trackSender);
      if (publication) {
        this._removeListener(publication);
        this.didUpdate();
      }
      return publication;
    }

    /**
     * Updates the verbosity of network quality information.
     * @param {NetworkQualityConfiguration} networkQualityConfiguration
     * @returns {void}
     */

  }, {
    key: 'setNetworkQualityConfiguration',
    value: function setNetworkQualityConfiguration(networkQualityConfiguration) {
      this.networkQualityConfiguration.update(networkQualityConfiguration);
    }
  }]);

  return LocalParticipantV2;
}(LocalParticipantSignaling);

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