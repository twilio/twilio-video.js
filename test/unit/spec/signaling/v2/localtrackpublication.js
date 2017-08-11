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

        before(() => {
          mediaStreamTrack = new FakeMediaStreamTrack(makeKind());
          mediaStreamTrack.enabled = makeEnabled();
          localTrackPublicationV2 = shouldUseNew
            ? new LocalTrackPublicationV2(mediaStreamTrack)
            : LocalTrackPublicationV2(mediaStreamTrack);
        });

        it('should return a LocalTrackPublicationV2', () => {
          assert(localTrackPublicationV2 instanceof LocalTrackPublicationV2);
        });

        it('should set .mediaStreamTrack', () => {
          assert.equal(localTrackPublicationV2.mediaStreamTrack, mediaStreamTrack);
        });

        it('should set .sid to null', () => {
          assert.equal(localTrackPublicationV2.sid, null);
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
        localTrackPublicationV2 = new LocalTrackPublicationV2(mediaStreamTrack);
        state = localTrackPublicationV2.getState();
      });

      context('should return an object whose', () => {
        [
          [ 'id', 'id' ],
          [ 'kind', 'kind' ],
          [ 'enabled', 'isEnabled' ]
        ].forEach(([ stateProp, ltProp ]) => {
          it(`.${stateProp} is equal to the LocalTrackPublicationV2's ${ltProp}`, () => {
            assert.equal(state[stateProp], localTrackPublicationV2[ltProp]);
          });
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
        localTrackPublicationV2 = new LocalTrackPublicationV2(mediaStreamTrack);
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
        localTrackPublicationV2 = new LocalTrackPublicationV2(mediaStreamTrack);
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

    before(() => {
      const mediaStreamTrack = new FakeMediaStreamTrack(makeKind());
      sid = makeSid();
      localTrackPublicationV2 = new LocalTrackPublicationV2(mediaStreamTrack);
      localTrackPublicationV2.once('updated', () => updated = true);
      ret = localTrackPublicationV2.setSid(sid);
    });

    context('when .sid is null', () => {
      it('should set .sid to the value passed to it', () => {
        assert.equal(localTrackPublicationV2.sid, sid);
      });

      it('should emit "updated"', () => {
        assert(updated);
      });
    });

    context('when .sid is non-null', () => {
      let ret1;
      let sid1;
      let updated1;

      before(() => {
        sid1 = makeSid();
        localTrackPublicationV2.once('updated', () => updated1 = true);
        ret1 = localTrackPublicationV2.setSid(sid1);
      });

      it('should not set .sid to the value passed to it', () => {
        assert.equal(localTrackPublicationV2.sid, sid);
      });

      it('should not emit "updated"', () => {
        assert(!updated1);
      });
    });

    it('should return the LocalTrackPublicationV2', () => {
      assert.equal(ret, localTrackPublicationV2);
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
