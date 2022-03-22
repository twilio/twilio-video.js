'use strict';

const assert = require('assert');
const sinon = require('sinon');

const TwilioWarning = require('../../../../../lib/util/twiliowarning');
const LocalTrackPublicationV2 = require('../../../../../lib/signaling/v2/localtrackpublication');
const { makeUUID } = require('../../../../../lib/util');

const { FakeMediaStreamTrack } = require('../../../../lib/fakemediastream');
const log = require('../../../../lib/fakelog');

describe('LocalTrackPublicationV2', () => {
  // LocalTrackPublicationV2
  // ------------

  describe('constructor', () => {
    let localTrackPublicationV2;
    let mediaStreamTrack;
    let mediaTrackSender;
    let name;
    let priority;

    before(() => {
      mediaStreamTrack = new FakeMediaStreamTrack(makeKind());
      mediaStreamTrack.enabled = makeEnabled();
      mediaTrackSender = makeTrackSender(mediaStreamTrack);
      name = makeUUID();
      priority = makePriority();
      localTrackPublicationV2 = new LocalTrackPublicationV2(mediaTrackSender, name, priority, { log });
    });

    it('should return a LocalTrackPublicationV2', () => {
      assert(localTrackPublicationV2 instanceof LocalTrackPublicationV2);
    });

    it('should set .trackTransceiver to a clone of the MediaTrackSender', () => {
      assert.equal(localTrackPublicationV2.trackTransceiver, mediaTrackSender.clones[0]);
    });

    it('should set .sid to null', () => {
      assert.equal(localTrackPublicationV2.sid, null);
    });

    it('should set the .name property', () => {
      assert.equal(localTrackPublicationV2.name, name);
    });

    it('should set the .priority property', () => {
      assert.equal(localTrackPublicationV2.priority, priority);
    });

    it('should set the .updatedPriority property', () => {
      assert.equal(localTrackPublicationV2.updatedPriority, priority);
    });

    [
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
      let priority;
      let state;

      before(() => {
        mediaStreamTrack = new FakeMediaStreamTrack(makeKind());
        mediaStreamTrack.enabled = makeEnabled();
        priority = makePriority();
        localTrackPublicationV2 = new LocalTrackPublicationV2(makeTrackSender(mediaStreamTrack), makeUUID(), priority, { log });
        state = localTrackPublicationV2.getState();
      });

      context('should return an object whose', () => {
        [
          ['id', 'id'],
          ['kind', 'kind'],
          ['enabled', 'isEnabled'],
          ['name', 'name'],
          ['priority', 'priority']
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
          localTrackPublicationV2 = new LocalTrackPublicationV2(makeTrackSender(new FakeMediaStreamTrack()), makeUUID(), makePriority(), { log });
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
          localTrackPublicationV2 = new LocalTrackPublicationV2(makeTrackSender(new FakeMediaStreamTrack()), makeUUID(), makePriority(), { log });
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

  describe('#updateMediaStates', () => {
    let localTrackPublicationV2;
    let onWarning;
    let onWarningsCleared;

    beforeEach(() => {
      localTrackPublicationV2 = new LocalTrackPublicationV2(makeTrackSender(new FakeMediaStreamTrack()), makeUUID(), makePriority(), { log });

      onWarning = sinon.stub();
      onWarningsCleared = sinon.stub();

      localTrackPublicationV2.on('warning', onWarning);
      localTrackPublicationV2.on('warningsCleared', onWarningsCleared);
    });

    it('should do nothing if media states is empty', () => {
      assert(!!localTrackPublicationV2.updateMediaStates());
      assert(!!localTrackPublicationV2.updateMediaStates({}));
      sinon.assert.notCalled(onWarning);
      sinon.assert.notCalled(onWarningsCleared);
    });

    it('should do nothing if an unknown state is detected', () => {
      localTrackPublicationV2.updateMediaStates({ recordings: 'foo' });
      sinon.assert.notCalled(onWarning);
      sinon.assert.notCalled(onWarningsCleared);
    });

    it('should emit warning if no media is detected', () => {
      localTrackPublicationV2.updateMediaStates({ recordings: 'NO_MEDIA' });
      sinon.assert.calledOnce(onWarning);
      sinon.assert.calledWithExactly(onWarning, TwilioWarning.RECORDING_MEDIA_LOST);
      sinon.assert.notCalled(onWarningsCleared);
    });

    it('should emit warning once', () => {
      localTrackPublicationV2.updateMediaStates({ recordings: 'NO_MEDIA' });
      localTrackPublicationV2.updateMediaStates({ recordings: 'NO_MEDIA' });
      sinon.assert.calledOnce(onWarning);
      sinon.assert.calledWithExactly(onWarning, TwilioWarning.RECORDING_MEDIA_LOST);
      sinon.assert.notCalled(onWarningsCleared);
    });

    it('should emit warningsCleared if media is detected', () => {
      localTrackPublicationV2.updateMediaStates({ recordings: 'OK' });
      sinon.assert.calledOnce(onWarningsCleared);
      sinon.assert.notCalled(onWarning);
    });

    it('should emit warningsCleared once', () => {
      localTrackPublicationV2.updateMediaStates({ recordings: 'OK' });
      localTrackPublicationV2.updateMediaStates({ recordings: 'OK' });
      sinon.assert.calledOnce(onWarningsCleared);
      sinon.assert.notCalled(onWarning);
    });

    it('should emit events in sequence properly', () => {
      localTrackPublicationV2.updateMediaStates({ recordings: 'NO_MEDIA' });
      sinon.assert.calledOnce(onWarning);
      sinon.assert.calledWithExactly(onWarning, TwilioWarning.RECORDING_MEDIA_LOST);
      sinon.assert.notCalled(onWarningsCleared);

      localTrackPublicationV2.updateMediaStates({ recordings: 'OK' });
      sinon.assert.calledOnce(onWarningsCleared);
      sinon.assert.calledOnce(onWarning);

      localTrackPublicationV2.updateMediaStates({ recordings: 'NO_MEDIA' });
      sinon.assert.calledTwice(onWarning);
      sinon.assert.calledWithExactly(onWarning, TwilioWarning.RECORDING_MEDIA_LOST);
      sinon.assert.calledOnce(onWarningsCleared);

      localTrackPublicationV2.updateMediaStates({ recordings: 'OK' });
      sinon.assert.calledTwice(onWarningsCleared);
      sinon.assert.calledTwice(onWarning);
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
      localTrackPublicationV2 = new LocalTrackPublicationV2(makeTrackSender(mediaStreamTrack), makeUUID(), makePriority(), { log });
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

  // LocalTrackPublicationSignaling
  // ------------------------------

  describe('#enable', () => {
    [true, false].forEach(enabled => {
      describe(`called with \`${enabled}\``, () => {
        it(`sets the cloned MediaTrackSender's MediaStreamTrack's .enabled state to \`${enabled}\``, () => {
          const mediaTrackSender = makeTrackSender(new FakeMediaStreamTrack(makeKind()));
          const localTrackPublicationV2 = new LocalTrackPublicationV2(mediaTrackSender, makeUUID(), makePriority(), { log });
          const mediaStreamTrack = localTrackPublicationV2.trackTransceiver.track;
          mediaStreamTrack.enabled = !enabled;
          localTrackPublicationV2.enable(enabled);
          assert.equal(mediaStreamTrack.enabled, enabled);
        });
      });
    });
  });

  describe('#publishFailed', () => {
    let localTrackPublicationV2;
    let ret;
    let error;
    let updated;

    beforeEach(() => {
      const mediaStreamTrack = new FakeMediaStreamTrack(makeKind());
      error = new Error('Track publication failed');
      localTrackPublicationV2 = new LocalTrackPublicationV2(makeTrackSender(mediaStreamTrack), makeUUID(), makePriority(), { log });
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

  describe('#setPriority', () => {
    let initialPriority;
    let localTrackPublicationV2;
    let updated;

    beforeEach(() => {
      const mediaStreamTrack = new FakeMediaStreamTrack(makeKind());
      initialPriority = makePriority();
      localTrackPublicationV2 = new LocalTrackPublicationV2(makeTrackSender(mediaStreamTrack), makeUUID(), initialPriority, { log });
      updated = false;
    });

    ['same', 'different'].forEach(sameOrDifferent => {
      let priority;
      let ret;

      context(`when called with ${sameOrDifferent} priority`, () => {
        beforeEach(() => {
          priority = {
            different: makePriority(),
            same: localTrackPublicationV2.priority
          }[sameOrDifferent];
          localTrackPublicationV2.once('updated', () => { updated = true; });
          ret = localTrackPublicationV2.setPriority(priority);
        });

        it('should return the LocalTrackPublicationV2', () => {
          assert.equal(ret, localTrackPublicationV2);
        });

        if (sameOrDifferent === 'same') {
          it('should not change .priority', () => {
            assert.equal(localTrackPublicationV2.priority, initialPriority);
          });

          it('should not change .updatedPriority', () => {
            assert.equal(localTrackPublicationV2.updatedPriority, initialPriority);
          });

          it('should not emit "updated"', () => {
            assert(!updated);
          });
        } else {
          it('should not change .priority', () => {
            assert.equal(localTrackPublicationV2.priority, initialPriority);
          });

          it('should change .updatedPriority', () => {
            assert.equal(localTrackPublicationV2.updatedPriority, priority);
            assert.notEqual(localTrackPublicationV2.updatedPriority, localTrackPublicationV2.priority);
          });

          it('should emit "updated"', () => {
            assert(updated);
          });
        }
      });
    });

  });

  describe('#stop', () => {
    it('calls stop on the cloned MediaTrackSender\'s MediaStreamTrack', () => {
      const mediaTrackSender = makeTrackSender(new FakeMediaStreamTrack(makeKind()));
      const localTrackPublicationV2 = new LocalTrackPublicationV2(mediaTrackSender, makeUUID(), makePriority(), { log });
      const mediaStreamTrack = localTrackPublicationV2.trackTransceiver.track;
      mediaStreamTrack.stop = sinon.spy();
      localTrackPublicationV2.stop();
      assert(mediaStreamTrack.stop.calledOnce);
    });
  });
});

function makeEnabled() {
  return (Math.random() < 0.5);
}

function makeKind() {
  return ['audio', 'video'][Number(Math.random() > 0.5)];
}

function makePriority() {
  return makeUUID();
}

function makeSid() {
  return makeUUID();
}

function makeTrackSender(mediaStreamTrack) {
  const { id, kind } = mediaStreamTrack;
  return {
    id,
    kind,
    track: mediaStreamTrack,
    clones: [],
    clone() {
      const clone = makeTrackSender(mediaStreamTrack.clone());
      this.clones.push(clone);
      return clone;
    },
    stop() {
      mediaStreamTrack.stop();
    }
  };
}
