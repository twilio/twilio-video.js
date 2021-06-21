'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var LocalTrackPublicationSignaling = require('../localtrackpublication');
var createTwilioError = require('../../util/twilio-video-errors').createTwilioError;

/**
 * @extends LocalTrackPublicationSignaling
 */

var LocalTrackPublicationV2 = function (_LocalTrackPublicatio) {
  _inherits(LocalTrackPublicationV2, _LocalTrackPublicatio);

  /**
   * Construct a {@link LocalTrackPublicationV2}.
   * @param {DataTrackSender|MediaTrackSender} trackSender
   * @param {string} name
   * @param {Track.Priority} priority
   */
  function LocalTrackPublicationV2(trackSender, name, priority) {
    _classCallCheck(this, LocalTrackPublicationV2);

    return _possibleConstructorReturn(this, (LocalTrackPublicationV2.__proto__ || Object.getPrototypeOf(LocalTrackPublicationV2)).call(this, trackSender, name, priority));
  }

  /**
   * Get the {@link LocalTrackPublicationV2#Representation} of a given {@link TrackSignaling}.
   * @returns {LocalTrackPublicationV2#Representation} - without the SID
   */


  _createClass(LocalTrackPublicationV2, [{
    key: 'getState',
    value: function getState() {
      return {
        enabled: this.isEnabled,
        id: this.id,
        kind: this.kind,
        name: this.name,
        priority: this.updatedPriority
      };
    }

    /**
     * Compare the {@link LocalTrackPublicationV2} to a {@link LocalTrackPublicationV2#Representation} of itself
     * and perform any updates necessary.
     * @param {PublishedTrack} track
     * @returns {this}
     * @fires TrackSignaling#updated
     */

  }, {
    key: 'update',
    value: function update(track) {
      switch (track.state) {
        case 'ready':
          this.setSid(track.sid);
          break;
        case 'failed':
          {
            var error = track.error;
            this.publishFailed(createTwilioError(error.code, error.message));
            break;
          }
        default:
          // 'created'
          break;
      }
      return this;
    }
  }]);

  return LocalTrackPublicationV2;
}(LocalTrackPublicationSignaling);

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