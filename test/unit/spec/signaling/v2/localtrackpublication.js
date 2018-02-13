'use strict';

const assert = require('assert');

const LocalTrackPublicationV2 = require('../../../../../lib/signaling/v2/localtrackpublication');
const { makeUUID } = require('../../../../../lib/util');

const { FakeMediaStreamTrack } = require('../../../../lib/fakemediastream');

describe('LocalTrackPublicationV2', () => {
  // LocalTrackPublicationV2
  // ------------

  describe('constructor', () => {
    let localTrackPublicationV2;
    let mediaStreamTrack;
    let mediaTrackSender;
    let name;

    before(() => {
      mediaStreamTrack = new FakeMediaStreamTrack(makeKind());
      mediaStreamTrack.enabled = makeEnabled();
      mediaTrackSender = makeTrackSender(mediaStreamTrack);
      name = makeUUID();
      localTrackPublicationV2 = new LocalTrackPublicationV2(mediaTrackSender, name);
    });

    it('should return a LocalTrackPublicationV2', () => {
      assert(localTrackPublicationV2 instanceof LocalTrackPublicationV2);
    });

    it('should set .trackTransceiver', () => {
      assert.equal(localTrackPublicationV2.trackTransceiver, mediaTrackSender);
    });

    it('should set .sid to null', () => {
      assert.equal(localTrackPublicationV2.sid, null);
    });

    it('should set the .name property', () => {
      assert.equal(localTrackPublicationV2.name, name);
    });

    [
      ['id', 'id'],
      ['kind', 'kind'],
      ['isEnabled', 'enabled']
    ].forEach(([ltProp, mstProp]) => {
      it(`should set .${ltProp} to MediaStreamTrack's ${mstProp}`, () => {
        assert.equal(localTrackPublicationV2[ltProp], mediaStreamTrack[mstProp]);
      });
    });

    describe('#getState', () => {
      let localTrackPublicationV2;
      let mediaStreamTrack;
      let state;

      before(() => {
        mediaStreamTrack = new FakeMediaStreamTrack(makeKind());
        mediaStreamTrack.enabled = makeEnabled();
        localTrackPublicationV2 = new LocalTrackPublicationV2(makeTrackSender(mediaStreamTrack), makeUUID());
        state = localTrackPublicationV2.getState();
      });

      context('should return an object whose', () => {
        [
          ['id', 'id'],
          ['kind', 'kind'],
          ['enabled', 'isEnabled'],
          ['name', 'name']
        ].forEach(([stateProp, ltProp]) => {
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
          localTrackPublicationV2 = new LocalTrackPublicationV2(makeTrackSender(new FakeMediaStreamTrack()));
          updated = false;
          localTrackPublicationV2.once('updated', () => { updated = true; });
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
          localTrackPublicationV2 = new LocalTrackPublicationV2(makeTrackSender(new FakeMediaStreamTrack()));
          updated = false;
          localTrackPublicationV2.once('updated', () => { updated = true; });
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

  describe('#setSid', () => {
    let localTrackPublicationV2;
    let ret;
    let sid;
    let updated;

    beforeEach(() => {
      const mediaStreamTrack = new FakeMediaStreamTrack(makeKind());
      sid = makeSid();
      localTrackPublicationV2 = new LocalTrackPublicationV2(makeTrackSender(mediaStreamTrack), makeUUID());
      updated = false;
    });

    context('when .sid is null', () => {
      beforeEach(() => {
        localTrackPublicationV2.once('updated', () => { updated = true; });
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
    });

    context('when .sid is non-null', () => {
      beforeEach(() => {
        localTrackPublicationV2.setSid(sid);
        const newSid = makeSid();
        localTrackPublicationV2.once('updated', () => { updated = true; });
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
    });

    context('when .error is non-null', () => {
      let error;

      beforeEach(() => {
        error = new Error('Track publication failed');
        localTrackPublicationV2.publishFailed(error);
        sid = makeSid();
        localTrackPublicationV2.once('updated', () => { updated = true; });
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
      localTrackPublicationV2 = new LocalTrackPublicationV2(makeTrackSender(mediaStreamTrack));
      updated = false;
    });

    context('when .sid is null', () => {
      beforeEach(() => {
        localTrackPublicationV2.once('updated', () => { updated = true; });
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
    });

    context('when .sid is non-null', () => {
      let sid;

      beforeEach(() => {
        sid = makeSid();
        localTrackPublicationV2.setSid(sid);
        localTrackPublicationV2.once('updated', () => { updated = true; });
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
    });

    context('when .error is non-null', () => {
      beforeEach(() => {
        error = new Error('Track publication failed');
        localTrackPublicationV2.publishFailed(error);
        const newError = new Error('New error');
        localTrackPublicationV2.once('updated', () => { updated = true; });
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

function makeTrackSender(mediaStreamTrack) {
  const { id, kind } = mediaStreamTrack;
  return {
    id,
    kind,
    track: mediaStreamTrack
  };
}
