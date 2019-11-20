'use strict';

const RemoteTrackPublicationSignaling = require('../remotetrackpublication');

/**
 * @extends RemoteTrackPublicationSignaling
 */
class RemoteTrackPublicationV2 extends RemoteTrackPublicationSignaling {
  /**
   * Construct a {@link RemoteTrackPublicationV2}.
   * @param {RemoteTrackPublicationV2#Representation} track
   */
  constructor(track) {
    super(track.sid, track.name, track.kind, track.enabled, track.priority);
  }

  /**
   * Compare the {@link RemoteTrackPublicationV2} to a
   * {@link RemoteTrackPublicationV2#Representation} of itself and perform any
   * updates necessary.
   * @param {RemoteTrackPublicationV2#Representation} track
   * @returns {this}
   * @fires TrackSignaling#updated
   */
  update(track) {
    this.enable(track.enabled);
    this.setPriority(track.priority);
    return this;
  }
}

/**
 * The Room Signaling Protocol (RSP) representation of a {@link RemoteTrackPublicationV2}.
 * @typedef {LocalTrackPublicationV2#Representation} RemoteTrackPublicationV2#Representation
 * @property {boolean} subscribed
 */

module.exports = RemoteTrackPublicationV2;
