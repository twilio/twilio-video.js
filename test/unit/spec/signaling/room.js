'use strict';

const assert = require('assert');

const RoomSignaling = require('../../../../lib/signaling/room');
const { MediaConnectionError, SignalingConnectionDisconnectedError } = require('../../../../lib/util/twilio-video-errors');

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

      const reconnectError = signalingConnectionState === 'connected'
        ? mediaConnectionState === 'failed'
          ? new MediaConnectionError()
          : null
        : signalingConnectionState === 'reconnecting'
          ? new SignalingConnectionDisconnectedError()
          : null;

      describe(`the Signaling Connection State is "${signalingConnectionState}", and the Media Connection State is "${mediaConnectionState}"`, () => {
        let error;
        let room;
        let state;
        let stateChanged;

        before(() => {
          room = new RoomSignalingImpl();
          room.once('stateChanged', (state_, error_) => { stateChanged = true; state = state_; error = error_; });
          room.setSignalingConnectionState(signalingConnectionState);
          room.setMediaConnectionState(mediaConnectionState);
        });

        it(`sets the Room State to "${roomState}"`, () => {
          assert.equal(room.state, roomState);
          if (roomState === 'reconnecting') {
            assert.equal(state, roomState);
          }
        });

        if (roomState === 'reconnecting') {
          it(`emits "stateChanged" on RoomSignaling with a ${reconnectError.constructor.name}`, async () => {
            assert(error instanceof reconnectError.constructor);
          });
        } else {
          it('does not emit "stateChanged" on RoomSignaling', () => {
            assert(!stateChanged);
          });
        }
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
        let error;
        let room;
        let state;
        let stateChanged;

        before(() => {
          room = new RoomSignalingImpl();
          room.setMediaConnectionState('failed');
          room.once('stateChanged', (state_, error_) => { stateChanged = true; state = state_; error = error_; });
          room.setSignalingConnectionState(signalingConnectionState);
          room.setMediaConnectionState(mediaConnectionState);
        });

        it(`sets the Room State to "${roomState}"`, () => {
          assert.equal(room.state, roomState);
          if (roomState === 'connected') {
            assert.equal(state, roomState);
          }
        });

        if (roomState === 'connected') {
          it('emits "stateChanged" on RoomSignaling without a TwilioError', async () => {
            assert(stateChanged);
            assert.equal(typeof error, 'undefined');
          });
        } else {
          it('does not emit "stateChanged" on RoomSignaling', () => {
            assert(!stateChanged);
          });
        }
      });
    });
  });
});
