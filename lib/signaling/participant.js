'use strict';

var inherits = require('util').inherits;
var Media = require('../media');
var StateMachine = require('../statemachine');

/*
ParticipantSignaling States
----------------------

    +-----------+     +--------------+
    |           |     |              |
    | connected |---->| disconnected |
    |           |     |              |
    +-----------+     +--------------+

*/

var states = {
  connected: [
    'disconnected'
  ],
  disconnected: []
};

/**
 * Construct a {@link ParticipantSignaling}.
 * @class
 * @classdesc A {@link Participant} implementation
 * @extends StateMachine
 * @param {Participant.SID} sid
 * @param {string} identity
 * @param {string} [media] - Initial media to use, if any.
 * @property {string} identity
 * @property {Participant.SID} sid
 * @property {string} state - "connected", "disconnected" or "failed"
 */
function ParticipantSignaling(sid, identity, media) {
  media = media || new Media();
  StateMachine.call(this, 'connected', states);

  /* eslint no-use-before-define:0 */
  media.on(Media.TRACK_ADDED, this.emit.bind(this, TRACK_ADDED));
  media.on(Media.TRACK_DIMENSIONS_CHANGED, this.emit.bind(this, TRACK_DIMENSIONS_CHANGED));
  media.on(Media.TRACK_DISABLED, this.emit.bind(this, TRACK_DISABLED));
  media.on(Media.TRACK_ENABLED, this.emit.bind(this, TRACK_ENABLED));
  media.on(Media.TRACK_ENDED, this.emit.bind(this, TRACK_ENDED));
  media.on(Media.TRACK_REMOVED, this.emit.bind(this, TRACK_REMOVED));
  media.on(Media.TRACK_STARTED, this.emit.bind(this, TRACK_STARTED));

  Object.defineProperties(this, {
    identity: {
      enumerable: true,
      value: identity
    },
    media: {
      enumerable: true,
      value: media
    },
    sid: {
      enumerable: true,
      value: sid
    }
  });
}

var TRACK_ADDED = ParticipantSignaling.TRACK_ADDED = Media.TRACK_ADDED;
var TRACK_DIMENSIONS_CHANGED = ParticipantSignaling.TRACK_DIMENSIONS_CHANGED = Media.TRACK_DIMENSIONS_CHANGED;
var TRACK_DISABLED = ParticipantSignaling.TRACK_DISABLED = Media.TRACK_DISABLED;
var TRACK_ENABLED = ParticipantSignaling.TRACK_ENABLED = Media.TRACK_ENABLED;
var TRACK_ENDED = ParticipantSignaling.TRACK_ENDED = Media.TRACK_ENDED;
var TRACK_REMOVED = ParticipantSignaling.TRACK_REMOVED = Media.TRACK_REMOVED;
var TRACK_STARTED = ParticipantSignaling.TRACK_STARTED = Media.TRACK_STARTED;

inherits(ParticipantSignaling, StateMachine);

module.exports = ParticipantSignaling;
