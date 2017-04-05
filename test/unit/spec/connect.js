'use strict';

const assert = require('assert');
const connect = require('../../../lib/connect');
const fakeGetUserMedia = require('../../lib/fakemediastream').fakeGetUserMedia;
const inherits = require('util').inherits;
const RoomSignaling = require('../../../lib/signaling/room');
const Signaling = require('../../../lib/signaling');
const sinon = require('sinon');
const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImN0eSI6InR3aWxpby1mcGE7dj0xIn0.eyJqdGkiOiJTSzY3NGIxODg2OWYxMWZhY2M2NjVhNjVmZDRkZGYyZjRmLTE0NzUxOTAzNDgiLCJncmFudHMiOnsiaWRlbnRpdHkiOiJhc2QiLCJydGMiOnsiY29uZmlndXJhdGlvbl9wcm9maWxlX3NpZCI6IlZTM2Y3NWUwZjE0ZTdjOGIyMDkzOGZjNTA5MmU4MmYyM2EifX0sImlhdCI6MTQ3NTE5MDM0OCwiZXhwIjoxNDc1MTkzOTQ4LCJpc3MiOiJTSzY3NGIxODg2OWYxMWZhY2M2NjVhNjVmZDRkZGYyZjRmIiwic3ViIjoiQUM5NmNjYzkwNDc1M2IzMzY0ZjI0MjExZThkOTc0NmE5MyJ9.N0UuZSblqb7MknNuiRkiEVVEdmztm5AdYIhQp7zU2PI';
const AccessTokenInvalidError = require('../../../lib/util/twilio-video-errors').AccessTokenInvalidError;
const EventEmitter = require('events').EventEmitter;

describe('connect', () => {
  describe('called without ConnectOptions#tracks', () => {
    it ('automatically acquires LocalTracks', () => {
      const createLocalTracks = sinon.spy();
      connect(token, { createLocalTracks: createLocalTracks });
      assert(createLocalTracks.calledOnce);
    });

    describe('and then immediately canceled by calling .cancel()', () => {
      it('calls .stop() on the LocalTracks', () => {
        return fakeGetUserMedia({ audio: true, video: true }).then(stream => {
          const localTracks = stream.getTracks().map(track => {
            return new FakeLocalTrack(stream, track);
          });
          const createLocalTracks = () => {
            return Promise.resolve(localTracks);
          }
          const promise = connect(token, {
            createLocalTracks: createLocalTracks
          });

          promise.cancel();
          return promise.then(() => {
            throw new Error('Unexpected resolution');
          }, () => {
            localTracks.forEach(track => assert(track.stop.calledOnce));
          });
        });
      });
    });

    describe('when it succeeds', () => {
      it('sets shouldStopLocalTracks on the LocalParticipant', async () => {
        const stream = await fakeGetUserMedia({ audio: true, video: true });
        const tracks = stream.getTracks().map(track => new FakeLocalTrack(stream, track));
        const createLocalTracks = () => Promise.resolve(tracks);

        const mockSignaling = new Signaling();
        mockSignaling.connect = () => () => new RoomSignaling();
        function signaling() {
          return mockSignaling;
        }

        let shouldStopLocalTracks;
        function LocalParticipant(localParticipantSignaling, localTracks, options) {
          shouldStopLocalTracks = options.shouldStopLocalTracks;
        }

        const room = await connect(token, { LocalParticipant, createLocalTracks, signaling });
        assert.equal(shouldStopLocalTracks, true);
      });
    });
  });

  describe('called with ConnectOptions#tracks', () => {
    describe('when it succeeds', () => {
      it('does not set shouldStopLocalTracks on the LocalParticipant', async () => {
        const stream = await fakeGetUserMedia({ audio: true, video: true });
        const tracks = stream.getTracks().map(track => new FakeLocalTrack(stream, track));

        const mockSignaling = new Signaling();
        mockSignaling.connect = () => () => new RoomSignaling();
        function signaling() {
          return mockSignaling;
        }

        let shouldStopLocalTracks;
        function LocalParticipant(localParticipantSignaling, localTracks, options) {
          shouldStopLocalTracks = options.shouldStopLocalTracks;
        }

        const room = await connect(token, { LocalParticipant, tracks, signaling });
        assert.equal(shouldStopLocalTracks, false);
      });
    });
  });

  it('should reject if the token is invalid', () => {
    return new Promise((resolve, reject) => {
      connect('foo').then(reject, error => {
        try {
          assert(error instanceof AccessTokenInvalidError);
          assert.equal(error.code, 20101);
          resolve();
        } catch(e) {
          reject(e);
        }
      });
    });
  });
});

function FakeLocalTrack(mediaStream, mediaStreamTrack) {
  EventEmitter.call(this);
  this.id = mediaStreamTrack.id;
  this.kind = mediaStreamTrack.kind;
  this.mediaStream = mediaStream;
  this.mediaStreamTrack = mediaStreamTrack;
  this.stop = sinon.spy();
  this._signaling = { id: mediaStreamTrack.id };
}

inherits(FakeLocalTrack, EventEmitter);
