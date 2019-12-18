'use strict';

const assert = require('assert');

const RoomSignaling = require('../../../../lib/signaling/room');

const {
  MediaConnectionError,
  MediaDTLSTransportFailedError,
  SignalingConnectionDisconnectedError
} = require('../../../../lib/util/twilio-video-errors');

const { combinations } = require('../../../lib/util');

const connectionStates = [
  'new',
  'connecting',
  'connected',
  'disconnected',
  'failed',
  'closed'
];

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
  constructor(sessionTimeout = 30000) {
    super(null, null, null, { sessionTimeout });
    this.connectionState = 'new';
    this.signalingConnectionState = 'connected';
    this.mediaConnectionState = 'new';
  }

  setConnectionState(connectionState) {
    this.connectionState = connectionState;
    this.emit('connectionStateChanged');
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
    combinations([connectionStates, signalingConnectionStates, mediaConnectionStates]).forEach(([connectionState, signalingConnectionState, mediaConnectionState]) => {
      const roomState = connectionState === 'failed'
        ? 'disconnected'
        : signalingConnectionState === 'connected'
          ? mediaConnectionState === 'failed'
            ? 'reconnecting'
            : 'connected'
          : signalingConnectionState;

      const reconnectError = signalingConnectionState === 'connected'
        ? connectionState === 'failed' || mediaConnectionState === 'failed'
          ? new MediaConnectionError()
          : null
        : signalingConnectionState === 'reconnecting'
          ? new SignalingConnectionDisconnectedError()
          : null;

      describe(`the Connection State is "${connectionState}", the Signaling Connection State is "${signalingConnectionState}", and the Media Connection State is "${mediaConnectionState}"`, () => {
        let error;
        let room;
        let state;
        let stateChanged;

        before(() => {
          room = roomState === 'reconnecting' ? new RoomSignalingImpl(100) : new RoomSignalingImpl();
          room.once('stateChanged', (state_, error_) => { stateChanged = true; state = state_; error = error_; });
          room.setConnectionState(connectionState);
          room.setSignalingConnectionState(signalingConnectionState);
          room.setMediaConnectionState(mediaConnectionState);
        });

        it(`sets the Room State to "${roomState}"`, () => {
          assert.equal(room.state, roomState);
          if (roomState === 'reconnecting') {
            assert.equal(state, roomState);
          }
        });

        if (roomState === 'reconnecting' || roomState === 'disconnected') {
          const TwilioError = {
            disconnected: MediaDTLSTransportFailedError,
            reconnecting: reconnectError.constructor
          }[roomState];

          it(`emits "stateChanged" on RoomSignaling with a ${TwilioError.name}`, () => {
            assert(error instanceof TwilioError);
          });
        } else {
          it('does not emit "stateChanged" on RoomSignaling', () => {
            assert(!stateChanged);
          });
        }

        if (roomState === 'reconnecting') {
          context('and when the session timeout expires', () => {
            let timeoutError;
            let timeoutState;

            before(() => {
              return new Promise(resolve => {
                room.once('stateChanged', (state_, error_) => {
                  stateChanged = true; timeoutState = state_;
                  timeoutError = error_;
                  resolve();
                });
              });
            });

            it('should set the Room State to "disconnected"', () => {
              assert.equal(room.state, 'disconnected');
            });

            it(`should emit "stateChanged" on RoomSignaling  with a ${reconnectError.constructor.name}`, () => {
              assert.equal(timeoutState, 'disconnected');
              assert(timeoutError instanceof reconnectError.constructor);
            });
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
          // eslint-disable-next-line require-await
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
