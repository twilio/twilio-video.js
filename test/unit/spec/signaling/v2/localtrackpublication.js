'use strict';

const assert = require('assert');
const LocalTrackPublicationV2 = require('../../../../../lib/signaling/v2/localtrackpublication');
const { makeUUID } = require('../../../../../lib/util');
const { FakeMediaStreamTrack } = require('../../../../lib/fakemediastream');

describe('LocalTrackPublicationV2', () => {
  // LocalTrackPublicationV2
  // ------------

  describe('constructor', () => {
    [ true, false ].forEach(shouldUseNew => {
      context(`when called with${shouldUseNew ? '' : 'out'} "new"`, () => {
        let localTrackPublicationV2;
        let mediaStreamTrack;
        let name;

        before(() => {
          mediaStreamTrack = new FakeMediaStreamTrack(makeKind());
          mediaStreamTrack.enabled = makeEnabled();
          name = makeUUID();
          localTrackPublicationV2 = shouldUseNew
            ? new LocalTrackPublicationV2(mediaStreamTrack, name)
            : LocalTrackPublicationV2(mediaStreamTrack, name);
        });

        it('should return a LocalTrackPublicationV2', () => {
          assert(localTrackPublicationV2 instanceof LocalTrackPublicationV2);
        });

        it('should set .mediaStreamTrack', () => {
          assert.equal(localTrackPublicationV2.mediaStreamTrackOrDataTrackTransceiver, mediaStreamTrack);
        });

        it('should set .sid to null', () => {
          assert.equal(localTrackPublicationV2.sid, null);
        });

        it('should set the .name property', () => {
          assert.equal(localTrackPublicationV2.name, name);
        });

        [
          [ 'id', 'id' ],
          [ 'kind', 'kind' ],
          [ 'isEnabled', 'enabled' ]
        ].forEach(([ ltProp, mstProp ]) => {
          it(`should set .${ltProp} to MediaStreamTrack's ${mstProp}`, () => {
            assert.equal(localTrackPublicationV2[ltProp], mediaStreamTrack[mstProp]);
          });
        });
      });
    });

    describe('#getState', () => {
      let localTrackPublicationV2;
      let mediaStreamTrack;
      let state;

      before(() => {
        mediaStreamTrack = new FakeMediaStreamTrack(makeKind());
        mediaStreamTrack.enabled = makeEnabled();
        localTrackPublicationV2 = new LocalTrackPublicationV2(mediaStreamTrack, makeUUID());
        state = localTrackPublicationV2.getState();
      });

      context('should return an object whose', () => {
        [
          [ 'id', 'id' ],
          [ 'kind', 'kind' ],
          [ 'enabled', 'isEnabled' ],
          [ 'name', 'name' ]
        ].forEach(([ stateProp, ltProp ]) => {
          it(`.${stateProp} is equal to the LocalTrackPublicationV2's ${ltProp}`, () => {
            assert.equal(state[stateProp], localTrackPublicationV2[ltProp]);
          });
        });
      });
    });
  });

  describe('#update', () => {
    context('when called with a ReadyTrack payload', () => {
      context('and the .sid is null', () => {
        let localTrackPublicationV2;
        let payload;
        let ret;
        let updated;

        beforeEach(() => {
          payload = { state: 'ready', sid: makeSid() };
          localTrackPublicationV2 = new LocalTrackPublicationV2(new FakeMediaStreamTrack());
          updated = false;
          localTrackPublicationV2.once('updated', () => updated = true);
          ret = localTrackPublicationV2.update(payload);
        });

        it('returns the LocalTrackPublicationV2', () => {
          assert.equal(ret, localTrackPublicationV2);
        });

        it('sets the .sid', () => {
          assert.equal(localTrackPublicationV2.sid, payload.sid);
        });

        it('.error remains null', () => {
          assert.equal(localTrackPublicationV2.error, null);
        });

        it('emits the "updated" event', () => {
          assert(updated);
        });
      });
    });

    context('when called with a FailedTrack payload', () => {
      context('and the .error is null', () => {
        let localTrackPublicationV2;
        let payload;
        let ret;
        let updated;

        beforeEach(() => {
          payload = { state: 'failed', error: { code: 1, message: 'foo' } };
          localTrackPublicationV2 = new LocalTrackPublicationV2(new FakeMediaStreamTrack());
          updated = false;
          localTrackPublicationV2.once('updated', () => updated = true);
          ret = localTrackPublicationV2.update(payload);
        });

        it('returns the LocalTrackPublicationV2', () => {
          assert.equal(ret, localTrackPublicationV2);
        });

        it('.sid remains null', () => {
          assert.equal(localTrackPublicationV2.sid, null);
        });

        it('sets the .error to a TwilioError', () => {
          assert.equal(localTrackPublicationV2.error.code, payload.error.code);
          assert.equal(localTrackPublicationV2.error.message, payload.error.message);
        });

        it('emits the "updated" event', () => {
          assert(updated);
        });
      });
    });
  });

  // TrackSignaling
  // --------------

  describe('#getSid', () => {
    context('when called before #setSid', () => {
      let localTrackPublicationV2;
      let sid;

      before(() => {
        const mediaStreamTrack = new FakeMediaStreamTrack(makeKind());
        sid = makeSid();
        localTrackPublicationV2 = new LocalTrackPublicationV2(mediaStreamTrack, makeUUID());
      });

      it('should return a Promise that is resolved with the value passed to #setSid when it is eventually called', async () => {
        const promise = localTrackPublicationV2.getSid();
        localTrackPublicationV2.setSid(sid);
        const _sid = await promise;
        assert.equal(_sid, sid);
      });
    });

    context('when called after #setSid', () => {
      let localTrackPublicationV2;
      let sid;

      before(() => {
        const mediaStreamTrack = new FakeMediaStreamTrack(makeKind());
        sid = makeSid();
        localTrackPublicationV2 = new LocalTrackPublicationV2(mediaStreamTrack, makeUUID());
        localTrackPublicationV2.setSid(sid);
      });

      it('should return a Promise that is resolved with the value passed to #setSid', async () => {
        const _sid = await localTrackPublicationV2.getSid();
        assert.equal(_sid, sid);
      });
    });
  });

  describe('#setSid', () => {
    let localTrackPublicationV2;
    let ret;
    let sid;
    let updated;

    beforeEach(() => {
      const mediaStreamTrack = new FakeMediaStreamTrack(makeKind());
      sid = makeSid();
      localTrackPublicationV2 = new LocalTrackPublicationV2(mediaStreamTrack, makeUUID());
      updated = false;
      // NOTE(mroberts): Suppress Node warnings.
      localTrackPublicationV2.getSid().catch(() => {});
    });

    context('when .sid is null', () => {
      beforeEach(() => {
        localTrackPublicationV2.once('updated', () => updated = true);
        ret = localTrackPublicationV2.setSid(sid);
      });

      it('should return the LocalTrackPublicationV2', () => {
        assert.equal(ret, localTrackPublicationV2);
      });

      it('should set .sid to the value passed to it', () => {
        assert.equal(localTrackPublicationV2.sid, sid);
      });

      it('.error should remain null', () => {
        assert.equal(localTrackPublicationV2.error, null);
      });

      it('should emit "updated"', () => {
        assert(updated);
      });

      describe('#getSid', () => {
        it('should resolve with the SID', async () => {
          const _sid = await localTrackPublicationV2.getSid();
          assert.equal(_sid, sid);
        });
      });
    });

    context('when .sid is non-null', () => {
      beforeEach(() => {
        localTrackPublicationV2.setSid(sid);
        const newSid = makeSid();
        localTrackPublicationV2.once('updated', () => updated = true);
        ret = localTrackPublicationV2.setSid(newSid);
      });

      it('should return the LocalTrackPublicationV2', () => {
        assert.equal(ret, localTrackPublicationV2);
      });

      it('should not set .sid to the value passed to it', () => {
        assert.equal(localTrackPublicationV2.sid, sid);
      });

      it('.error should remain null', () => {
        assert.equal(localTrackPublicationV2.error, null);
      });

      it('should not emit "updated"', () => {
        assert(!updated);
      });

      describe('#getSid', () => {
        it('should resolve with the original SID', async () => {
          const _sid = await localTrackPublicationV2.getSid();
          assert.equal(_sid, sid);
        });
      });
    });

    context('when .error is non-null', () => {
      let error;

      beforeEach(() => {
        error = new Error('Track publication failed');
        localTrackPublicationV2.publishFailed(error);
        sid = makeSid();
        localTrackPublicationV2.once('updated', () => updated = true);
        ret = localTrackPublicationV2.setSid(sid);
      });

      it('should return the LocalTrackPublicationV2', () => {
        assert.equal(ret, localTrackPublicationV2);
      });

      it('.sid should remain null', () => {
        assert.equal(localTrackPublicationV2.sid, null);
      });

      it('.error should remain the same', () => {
        assert.equal(localTrackPublicationV2.error, error);
      });

      it('should not emit "updated"', () => {
        assert(!updated);
      });

      describe('#getSid', () => {
        it('should reject with the error', async () => {
          const _error = await localTrackPublicationV2.getSid().then(() => {
            throw new Error('Unexpected resolution');
          }, error => error);
          assert.equal(_error, error);
        });
      });
    });
  });

  // LocalTrackSignaling
  // -------------------

  describe('#publishFailed', () => {
    let localTrackPublicationV2;
    let ret;
    let error;
    let updated;

    beforeEach(() => {
      const mediaStreamTrack = new FakeMediaStreamTrack(makeKind());
      error = new Error('Track publication failed');
      localTrackPublicationV2 = new LocalTrackPublicationV2(mediaStreamTrack);
      // NOTE(mroberts): Suppress Node warnings.
      localTrackPublicationV2.getSid().catch(() => {});
      updated = false;
    });

    context('when .sid is null', () => {
      beforeEach(() => {
        localTrackPublicationV2.once('updated', () => updated = true);
        ret = localTrackPublicationV2.publishFailed(error);
      });

      it('should return the LocalTrackPublicationV2', () => {
        assert.equal(ret, localTrackPublicationV2);
      });

      it('.sid should remain null', () => {
        assert.equal(localTrackPublicationV2.sid, null);
      });

      it('should set .error to the error', () => {
        assert.equal(localTrackPublicationV2.error, error);
      });

      it('should emit "updated"', () => {
        assert(updated);
      });

      describe('#getSid', () => {
        it('should reject with the error', async () => {
          const _error = await localTrackPublicationV2.getSid().then(() => {
            throw new Error('Unexpected resolution');
          }, error => error);
          assert.equal(_error, error);
        });
      });
    });

    context('when .sid is non-null', () => {
      let sid;

      beforeEach(() => {
        sid = makeSid();
        localTrackPublicationV2.setSid(sid);
        localTrackPublicationV2.once('updated', () => updated = true);
        ret = localTrackPublicationV2.publishFailed(error);
      });

      it('should return the LocalTrackPublicationV2', () => {
        assert.equal(ret, localTrackPublicationV2);
      });

      it('.sid should remain non-null', () => {
        assert.equal(localTrackPublicationV2.sid, sid);
      });

      it('.error should remain null', () => {
        assert.equal(localTrackPublicationV2.error, null);
      });

      it('should not emit "updated"', () => {
        assert(!updated);
      });

      describe('#getSid', () => {
        it('should resolve with the SID', async () => {
          const _sid = await localTrackPublicationV2.getSid();
          assert.equal(_sid, sid);
        });
      });
    });

    context('when .error is non-null', () => {
      beforeEach(() => {
        error = new Error('Track publication failed');
        localTrackPublicationV2.publishFailed(error);
        const newError = new Error('New error');
        localTrackPublicationV2.once('updated', () => updated = true);
        ret = localTrackPublicationV2.publishFailed(newError);
      });

      it('should return the LocalTrackPublicationV2', () => {
        assert.equal(ret, localTrackPublicationV2);
      });

      it('.sid should remain null', () => {
        assert.equal(localTrackPublicationV2.sid, null);
      });

      it('.error should remain the same', () => {
        assert.equal(localTrackPublicationV2.error, error);
      });

      it('should not emit "updated"', () => {
        assert(!updated);
      });

      describe('#getSid', () => {
        it('should reject with the original error', async () => {
          const _error = await localTrackPublicationV2.getSid().then(() => {
            throw new Error('Unexpected resolution');
          }, error => error);
          assert.equal(_error, error);
        });
      });
    });
  });

});

function makeEnabled() {
  return (Math.random() < 0.5);
}

function makeKind() {
  return ['audio', 'video'][Number(Math.random() > 0.5)];
}

function makeSid() {
  return makeUUID();
}
