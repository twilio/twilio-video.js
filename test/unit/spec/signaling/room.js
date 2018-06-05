'use strict';

const assert = require('assert');

const RoomSignaling = require('../../../../lib/signaling/room');

const { combinations } = require('../../../lib/util');

const mediaConnectionStates = [
  'new',
  'checking',
  'connected',
  'completed',
  'disconnected',
  'failed',
  'closed'
];

const signalingConnectionStates = [
  'connected',
  'reconnecting'
];

class RoomSignalingImpl extends RoomSignaling {
  constructor() {
    super();
    this.signalingConnectionState = 'connected';
    this.mediaConnectionState = 'new';
  }

  setMediaConnectionState(mediaConnectionState) {
    this.mediaConnectionState = mediaConnectionState;
    this.emit('mediaConnectionStateChanged');
  }

  setSignalingConnectionState(signalingConnectionState) {
    this.signalingConnectionState = signalingConnectionState;
    this.emit('signalingConnectionStateChanged');
  }
}

describe('RoomSignaling', () => {
  describe('when the Media Connection is not reconnecting,', () => {
    combinations([signalingConnectionStates, mediaConnectionStates]).forEach(([signalingConnectionState, mediaConnectionState]) => {
      const roomState = signalingConnectionState === 'connected'
        ? mediaConnectionState === 'failed'
            ? 'reconnecting'
            : 'connected'
        : signalingConnectionState;

      describe(`the Signaling Connection State is "${signalingConnectionState}", and the Media Connection State is "${mediaConnectionState}"`, () => {
        it(`sets the Room State to "${roomState}"`, () => {
          const room = new RoomSignalingImpl();

          room.setMediaConnectionState(mediaConnectionState);
          room.setSignalingConnectionState(signalingConnectionState);

          assert.equal(room.state, roomState);
        });
      });
    });
  });

  describe('when the Media Connection is reconnecting', () => {
    combinations([signalingConnectionStates, mediaConnectionStates]).forEach(([signalingConnectionState, mediaConnectionState]) => {
      const roomState = signalingConnectionState === 'connected'
        ? mediaConnectionState === 'new' || mediaConnectionState === 'checking'
            ? 'reconnecting'
            : mediaConnectionState === 'failed'
              ? 'reconnecting'
              : 'connected'
        : signalingConnectionState;

      describe(`the Signaling Connection State is "${signalingConnectionState}", and the Media Connection State is "${mediaConnectionState}"`, () => {
        it(`sets the Room State to "${roomState}"`, () => {
          const room = new RoomSignalingImpl();
          room.setMediaConnectionState('failed');

          room.setMediaConnectionState(mediaConnectionState);
          room.setSignalingConnectionState(signalingConnectionState);

          assert.equal(room.state, roomState);
        });
      });
    });
  });
});
