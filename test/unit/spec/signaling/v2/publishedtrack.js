'use strict';

const assert = require('assert');
const PublishedTrackV2 = require('../../../../../lib/signaling/v2/publishedtrack');
const { makeUUID } = require('../../../../../lib/util');
const { FakeMediaStreamTrack } = require('../../../../lib/fakemediastream');

describe('PublishedTrackV2', () => {
  // PublishedTrackV2
  // ------------

  describe('constructor', () => {
    [ true, false ].forEach(shouldUseNew => {
      context(`when called with${shouldUseNew ? '' : 'out'} "new"`, () => {
        let publishedTrackV2;
        let mediaStreamTrack;

        before(() => {
          mediaStreamTrack = new FakeMediaStreamTrack(makeKind());
          mediaStreamTrack.enabled = makeEnabled();
          publishedTrackV2 = shouldUseNew
            ? new PublishedTrackV2(mediaStreamTrack)
            : PublishedTrackV2(mediaStreamTrack);
        });

        it('should return a PublishedTrackV2', () => {
          assert(publishedTrackV2 instanceof PublishedTrackV2);
        });

        it('should set .mediaStreamTrack', () => {
          assert.equal(publishedTrackV2.mediaStreamTrack, mediaStreamTrack);
        });

        it('should set .sid to null', () => {
          assert.equal(publishedTrackV2.sid, null);
        });

        [
          [ 'id', 'id' ],
          [ 'kind', 'kind' ],
          [ 'isEnabled', 'enabled' ]
        ].forEach(([ ltProp, mstProp ]) => {
          it(`should set .${ltProp} to MediaStreamTrack's ${mstProp}`, () => {
            assert.equal(publishedTrackV2[ltProp], mediaStreamTrack[mstProp]);
          });
        });
      });
    });

    describe('#getState', () => {
      let publishedTrackV2;
      let mediaStreamTrack;
      let state;

      before(() => {
        mediaStreamTrack = new FakeMediaStreamTrack(makeKind());
        mediaStreamTrack.enabled = makeEnabled();
        publishedTrackV2 = new PublishedTrackV2(mediaStreamTrack);
        state = publishedTrackV2.getState();
      });

      context('should return an object whose', () => {
        [
          [ 'id', 'id' ],
          [ 'kind', 'kind' ],
          [ 'enabled', 'isEnabled' ]
        ].forEach(([ stateProp, ltProp ]) => {
          it(`.${stateProp} is equal to the PublishedTrackV2's ${ltProp}`, () => {
            assert.equal(state[stateProp], publishedTrackV2[ltProp]);
          });
        });
      });
    });
  });

  // TrackSignaling
  // --------------

  describe('#getSid', () => {
    context('when called before #setSid', () => {
      let publishedTrackV2;
      let sid;

      before(() => {
        const mediaStreamTrack = new FakeMediaStreamTrack(makeKind());
        sid = makeSid();
        publishedTrackV2 = new PublishedTrackV2(mediaStreamTrack);
      });

      it('should return a Promise that is resolved with the value passed to #setSid when it is eventually called', async () => {
        const promise = publishedTrackV2.getSid();
        publishedTrackV2.setSid(sid);
        const _sid = await promise;
        assert.equal(_sid, sid);
      });
    });

    context('when called after #setSid', () => {
      let publishedTrackV2;
      let sid;

      before(() => {
        const mediaStreamTrack = new FakeMediaStreamTrack(makeKind());
        sid = makeSid();
        publishedTrackV2 = new PublishedTrackV2(mediaStreamTrack);
        publishedTrackV2.setSid(sid);
      });

      it('should return a Promise that is resolved with the value passed to #setSid', async () => {
        const _sid = await publishedTrackV2.getSid();
        assert.equal(_sid, sid);
      });
    });
  });

  describe('#setSid', () => {
    let publishedTrackV2;
    let ret;
    let sid;
    let updated;

    before(() => {
      const mediaStreamTrack = new FakeMediaStreamTrack(makeKind());
      sid = makeSid();
      publishedTrackV2 = new PublishedTrackV2(mediaStreamTrack);
      publishedTrackV2.once('updated', () => updated = true);
      ret = publishedTrackV2.setSid(sid);
    });

    context('when .sid is null', () => {
      it('should set .sid to the value passed to it', () => {
        assert.equal(publishedTrackV2.sid, sid);
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
        publishedTrackV2.once('updated', () => updated1 = true);
        ret1 = publishedTrackV2.setSid(sid1);
      });

      it('should not set .sid to the value passed to it', () => {
        assert.equal(publishedTrackV2.sid, sid);
      });

      it('should not emit "updated"', () => {
        assert(!updated1);
      });
    });

    it('should return the PublishedTrackV2', () => {
      assert.equal(ret, publishedTrackV2);
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
