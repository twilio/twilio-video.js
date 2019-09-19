'use strict';

const ParticipantSignaling = require('./participant');

class LocalParticipantSignaling extends ParticipantSignaling {
  constructor() {
    super();
    Object.defineProperties(this, {
      _publicationsToTrackSenders: {
        value: new Map()
      },
      _trackSendersToPublications: {
        value: new Map()
      }
    });
  }

  /**
   * @param {DataTrackSender|MediaTrackSender} trackSender
   * @param {string} name
   * @param {Track.Priority} priority
   * @returns {LocalTrackPublicationSignaling} publication
   */
  addTrack(trackSender, name, priority) {
    const publication = this._createLocalTrackPublicationSignaling(trackSender, name, priority);
    this._trackSendersToPublications.set(trackSender, publication);
    this._publicationsToTrackSenders.set(publication, trackSender);
    super.addTrack(publication);
    return this;
  }

  /**
   * @param {DataTrackSender|MediaTrackSender} trackSender
   * @returns {?LocalTrackPublicationSignaling}
   */
  getPublication(trackSender) {
    return this._trackSendersToPublications.get(trackSender) || null;
  }

  /**
   * @param {LocalTrackPublicationSignaling} trackPublication
   * @returns {?DataTrackSender|MediaTrackSender}
   */
  getSender(trackPublication) {
    return this._publicationsToTrackSenders.get(trackPublication) || null;
  }

  /**
   * @param {DataTrackSender|MediaTrackSender} trackSender
   * @returns {?LocalTrackPublicationSignaling}
   */
  removeTrack(trackSender) {
    const publication = this._trackSendersToPublications.get(trackSender);
    if (!publication) {
      return null;
    }
    this._trackSendersToPublications.delete(trackSender);
    this._publicationsToTrackSenders.delete(publication);
    const didDelete = super.removeTrack(publication);
    if (didDelete) {
      publication.stop();
    }
    return publication;
  }
}

module.exports = LocalParticipantSignaling;
