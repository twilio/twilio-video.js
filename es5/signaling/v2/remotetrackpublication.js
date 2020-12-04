'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var RemoteTrackPublicationSignaling = require('../remotetrackpublication');

/**
 * @extends RemoteTrackPublicationSignaling
 */

var RemoteTrackPublicationV2 = function (_RemoteTrackPublicati) {
  _inherits(RemoteTrackPublicationV2, _RemoteTrackPublicati);

  /**
   * Construct a {@link RemoteTrackPublicationV2}.
   * @param {RemoteTrackPublicationV2#Representation} track
   */
  function RemoteTrackPublicationV2(track) {
    _classCallCheck(this, RemoteTrackPublicationV2);

    return _possibleConstructorReturn(this, (RemoteTrackPublicationV2.__proto__ || Object.getPrototypeOf(RemoteTrackPublicationV2)).call(this, track.sid, track.name, track.kind, track.enabled, track.priority));
  }

  /**
   * Compare the {@link RemoteTrackPublicationV2} to a
   * {@link RemoteTrackPublicationV2#Representation} of itself and perform any
   * updates necessary.
   * @param {RemoteTrackPublicationV2#Representation} track
   * @returns {this}
   * @fires TrackSignaling#updated
   */


  _createClass(RemoteTrackPublicationV2, [{
    key: 'update',
    value: function update(track) {
      this.enable(track.enabled);
      this.setPriority(track.priority);
      return this;
    }
  }]);

  return RemoteTrackPublicationV2;
}(RemoteTrackPublicationSignaling);

/**
 * The Room Signaling Protocol (RSP) representation of a {@link RemoteTrackPublicationV2}.
 * @typedef {LocalTrackPublicationV2#Representation} RemoteTrackPublicationV2#Representation
 * @property {boolean} subscribed
 */

module.exports = RemoteTrackPublicationV2;