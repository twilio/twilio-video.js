'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var TrackSignaling = require('./track');

/**
 * A {@link LocalTrackPublication} implementation
 * @extends TrackSignaling
 * @property {Track.ID} id
 */

var LocalTrackPublicationSignaling = function (_TrackSignaling) {
  _inherits(LocalTrackPublicationSignaling, _TrackSignaling);

  /**
   * Construct a {@link LocalTrackPublicationSignaling}. {@link TrackSenders}
   * are always cloned.
   * @param {DataTrackSender|MediaTrackSender} trackSender - the {@link TrackSender}
   *   of the {@link LocalTrack} to be published
   * @param {string} name - the name of the {@link LocalTrack} to be published
   * @param {Track.Priority} priority - initial {@link Track.Priority}
   */
  function LocalTrackPublicationSignaling(trackSender, name, priority) {
    _classCallCheck(this, LocalTrackPublicationSignaling);

    trackSender = trackSender.clone();
    var enabled = trackSender.kind === 'data' ? true : trackSender.track.enabled;

    var _this = _possibleConstructorReturn(this, (LocalTrackPublicationSignaling.__proto__ || Object.getPrototypeOf(LocalTrackPublicationSignaling)).call(this, name, trackSender.kind, enabled, priority));

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

  /**
   * The updated {@link Track.Priority} of the {@link LocalTrack}.
   * @property {Track.priority}
   */


  _createClass(LocalTrackPublicationSignaling, [{
    key: 'enable',


    /**
     * Enable (or disable) the {@link LocalTrackPublicationSignaling} if it is not
     * already enabled (or disabled). This also updates the cloned
     * {@link MediaTrackSender}'s MediaStreamTracks `enabled` state.
     * @param {boolean} [enabled=true]
     * @return {this}
     */
    value: function enable(enabled) {
      enabled = typeof enabled === 'boolean' ? enabled : true;
      this.trackTransceiver.track.enabled = enabled;
      return _get(LocalTrackPublicationSignaling.prototype.__proto__ || Object.getPrototypeOf(LocalTrackPublicationSignaling.prototype), 'enable', this).call(this, enabled);
    }

    /**
     * Rejects the SID's deferred promise with the given Error.
     * @param {Error} error
     * @returns {this}
     */

  }, {
    key: 'publishFailed',
    value: function publishFailed(error) {
      if (setError(this, error)) {
        this.emit('updated');
      }
      return this;
    }

    /**
     * Update the {@link Track.Priority} of the published {@link LocalTrack}.
     * @param {Track.priority} priority
     * @returns {this}
     */

  }, {
    key: 'setPriority',
    value: function setPriority(priority) {
      if (this._updatedPriority !== priority) {
        this._updatedPriority = priority;
        this.emit('updated');
      }
      return this;
    }

    /**
     * Set the published {@link LocalTrack}'s {@link Track.SID}.
     * @param {Track.SID} sid
     * @returns {this}
     */

  }, {
    key: 'setSid',
    value: function setSid(sid) {
      if (this._error) {
        return this;
      }
      return _get(LocalTrackPublicationSignaling.prototype.__proto__ || Object.getPrototypeOf(LocalTrackPublicationSignaling.prototype), 'setSid', this).call(this, sid);
    }

    /**
     * Stop the cloned {@link TrackSender}.
     * @returns {void}
     */

  }, {
    key: 'stop',
    value: function stop() {
      this.trackTransceiver.stop();
    }
  }, {
    key: 'updatedPriority',
    get: function get() {
      return this._updatedPriority;
    }
  }]);

  return LocalTrackPublicationSignaling;
}(TrackSignaling);

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