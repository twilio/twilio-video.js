'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var RemoteTrackSignaling = require('../remotetrack');

/**
 * @extends RemoteTrackSignaling
 */

var RemoteTrackV2 = function (_RemoteTrackSignaling) {
  _inherits(RemoteTrackV2, _RemoteTrackSignaling);

  /**
   * Construct a {@link RemoteTrackV2}.
   * @param {RemoteTrackV2#Representation} track
   */
  function RemoteTrackV2(track) {
    _classCallCheck(this, RemoteTrackV2);

    return _possibleConstructorReturn(this, (RemoteTrackV2.__proto__ || Object.getPrototypeOf(RemoteTrackV2)).call(this, track.sid, track.name, track.id, track.kind, track.enabled));
  }

  /**
   * Compare the {@link RemoteTrackV2} to a {@link RemoteTrackV2#Representation} of itself
   * and perform any updates necessary.
   * @param {RemoteTrackV2#Representation} track
   * @returns {this}
   * @fires TrackSignaling#updated
   */


  _createClass(RemoteTrackV2, [{
    key: 'update',
    value: function update(track) {
      this.enable(track.enabled);
      return this;
    }
  }]);

  return RemoteTrackV2;
}(RemoteTrackSignaling);

/**
 * The Room Signaling Protocol (RSP) representation of a {@link RemoteTrackV2}
 * @typedef {LocalTrackPublicationV2#Representation} RemoteTrackV2#Representation
 * @property (boolean} subscribed
 */

module.exports = RemoteTrackV2;