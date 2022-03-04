'use strict';

const assert = require('assert');

const { combinationContext } = require('../../../../lib/util');
const RemoteTrackPublicationV3 = require('../../../../../lib/signaling/v3/remotetrackpublication');
const { makeUUID } = require('../../../../../lib/util');

describe('RemoteTrackPublicationV3', () => {
  describe('constructor', () => {
    ['kind', 'name', 'priority', 'sid'].forEach(prop => {
      it(`sets .${prop}`, () => {
        const trackState = {
          kind: makeKind(),
          name: makeUUID(),
          priority: makeUUID(),
          sid: makeSid()
        };
        const { isSwitchedOff, switchOffReason } = makeSwitchedOff();
        assert.equal((new RemoteTrackPublicationV3(trackState, isSwitchedOff, switchOffReason))[prop], trackState[prop]);
      });
    });

    [true, false].forEach(enabled => {
      context(`when trackState.enabled is ${enabled}`, () => {
        it(`sets .isEnabled to ${enabled}`, () => {
          assert.equal((new RemoteTrackPublicationV3({
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          }, true, enabled ? 'DISABLED_BY_SUBSCRIBER' : 'DISABLED_BY_PUBLISHER')).isEnabled, enabled);
        });
      });
    });

    [true, false].forEach(isSwitchedOff => {
      context(`when isSwitchedOff is ${isSwitchedOff}`, () => {
        it(`sets .isSwitchedOff to ${isSwitchedOff} and .switchOffReason${isSwitchedOff ? '' : ' to null'}`, () => {
          const track = new RemoteTrackPublicationV3({
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          }, isSwitchedOff, 'DISABLED_BY_SUBSCRIBER');
          assert.equal(track.isSwitchedOff, isSwitchedOff);
          assert.equal(track.switchOffReason, isSwitchedOff ? 'DISABLED_BY_SUBSCRIBER' : null);
        });
      });
    });
  });

  describe('#setSwitchedOff, when called', () => {
    combinationContext([
      [
        [true, false],
        x => `on a RemoteTrackPublicationV3 that is ${x ? 'enabled' : 'disabled'}`
      ],
      [
        [true, false],
        x => `with isSwitchedOff = ${x}, and`
      ],
      [
        [null, 'DISABLED_BY_PUBLISHER', 'DISABLED_BY_SUBSCRIBER'],
        x => `switchOffReason = ${x}`
      ]
    ], ([enabled, isSwitchedOff, switchOffReason]) => {
      const initialIsSwitchedOff = !enabled;
      const initialSwitchOffReason = enabled ? null : 'DISABLED_BY_PUBLISHER';
      let track;
      let updated;

      beforeEach(() => {
        track = new RemoteTrackPublicationV3(
          {
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          },
          initialIsSwitchedOff,
          initialSwitchOffReason
        );
        track.once('updated', () => { updated = true; });
        track.setSwitchedOff(isSwitchedOff, switchOffReason);
      });

      it(`should set .isSwitchedOff to ${isSwitchedOff}`, () => {
        assert.equal(track.isSwitchedOff, isSwitchedOff);
      });

      const expectedSwitchOffReason = isSwitchedOff ? switchOffReason : null;
      it(`should set .switchOffReason to ${expectedSwitchOffReason}`, () => {
        assert.equal(track.switchOffReason, expectedSwitchOffReason);
      });

      const expectedEnabled = !(isSwitchedOff && switchOffReason === 'DISABLED_BY_PUBLISHER');
      it(`should set .isEnabled to ${expectedEnabled}`, () => {
        assert.equal(track.isEnabled, expectedEnabled);
      });

      const shouldEmitUpdated = enabled !== expectedEnabled
        || initialIsSwitchedOff !== isSwitchedOff
        || initialSwitchOffReason !== expectedSwitchOffReason;

      it(`should ${shouldEmitUpdated ? '' : 'not '}emit "updated"`, () => {
        assert.equal(!!updated, shouldEmitUpdated);
      });
    });
  });

  describe('#setTrackTransceiver, when called with', () => {
    combinationContext([
      [
        [null, {}],
        x => `a ${x ? 'non-' : ''}null trackReceiver, and`
      ],
      [
        [true, false],
        x => `isSubscribed = ${x}`
      ]
    ], ([mediaTrackReceiver, isSubscribed]) => {
      it('returns the RemoteTrackPublicationV3', () => {
        const track = new RemoteTrackPublicationV3({
          kind: makeKind(),
          name: makeUUID(),
          priority: makeUUID(),
          sid: makeSid()
        }, false, null);
        assert.equal(track, track.setTrackTransceiver(mediaTrackReceiver, isSubscribed));
      });

      const expectedIsSubscribed = !!mediaTrackReceiver || isSubscribed;
      it(`sets .isSubscribed to ${expectedIsSubscribed}`, () => {
        const track = new RemoteTrackPublicationV3({
          kind: makeKind(),
          name: makeUUID(),
          priority: makeUUID(),
          sid: makeSid()
        }, false, null);
        assert.equal(track.setTrackTransceiver(mediaTrackReceiver, isSubscribed).isSubscribed, expectedIsSubscribed);
      });

      const shouldEmitUpdated = !!mediaTrackReceiver || isSubscribed;
      it(`${shouldEmitUpdated ? 'emits' : 'does not emit'} "updated"`, () => {
        const track = new RemoteTrackPublicationV3({
          kind: makeKind(),
          name: makeUUID(),
          priority: makeUUID(),
          sid: makeSid()
        }, false, null);

        let updated;
        track.once('updated', () => { updated = true; });
        track.setTrackTransceiver(mediaTrackReceiver, isSubscribed);
        assert(shouldEmitUpdated ? updated : !updated);
        assert.equal(track.trackTransceiver, mediaTrackReceiver);
      });
    });
  });

  describe('#update', () => {
    ['low', 'standard', 'high'].forEach(oldPriorityValue => {
      ['low', 'standard', 'high'].forEach(newPriorityValue => {
        context(`called with priority change: ${oldPriorityValue} => ${newPriorityValue}`, () => {
          it('returns the RemoteTrackPublicationV3', () => {
            const trackState = {
              kind: makeKind(),
              name: makeUUID(),
              priority: oldPriorityValue,
              sid: makeSid()
            };
            const track = new RemoteTrackPublicationV3(trackState, false, null);
            trackState.priority = newPriorityValue;
            assert.equal(track, track.update(trackState));
          });

          it('sets .priority to new value', () => {
            const trackState = {
              kind: makeKind(),
              name: makeUUID(),
              priority: oldPriorityValue,
              sid: makeSid()
            };
            const track = new RemoteTrackPublicationV3(trackState, false, null);
            trackState.priority = newPriorityValue;
            track.update(trackState);
            assert.equal(track.priority, newPriorityValue);
          });

          if (newPriorityValue !== oldPriorityValue) {
            it('emits an "updated" event with .priority set to newValue', () => {
              const trackState = {
                kind: makeKind(),
                name: makeUUID(),
                priority: oldPriorityValue,
                sid: makeSid()
              };

              let priority;
              const track = new RemoteTrackPublicationV3(trackState, false, null);
              trackState.priority = newPriorityValue;
              track.once('updated', () => { priority = track.priority; });
              track.update(trackState);
              assert.equal(priority, newPriorityValue);
            });
          } else {
            it('does not emit an "updated" event', () => {
              const trackState = {
                kind: makeKind(),
                name: makeUUID(),
                priority: oldPriorityValue,
                sid: makeSid()
              };

              let updated = false;
              const track = new RemoteTrackPublicationV3(trackState, false, null);
              trackState.priority = newPriorityValue;
              track.once('updated', () => { updated = true; });
              track.update(trackState);
              assert(!updated);
            });
          }
        });
      });
    });
  });

  // TrackSignaling
  // --------------

  describe('#disable', () => {
    context('called when the RemoteTrackPublicationV3 is enabled', () => {
      it('returns the RemoteTrackPublicationV3', () => {
        const track = new RemoteTrackPublicationV3({
          kind: makeKind(),
          name: makeUUID(),
          priority: makeUUID(),
          sid: makeSid()
        }, false, null);
        assert.equal(track, track.disable());
      });

      it('sets .isEnabled to false', () => {
        const track = new RemoteTrackPublicationV3({
          kind: makeKind(),
          name: makeUUID(),
          priority: makeUUID(),
          sid: makeSid()
        }, false, null);
        track.disable();
        assert(!track.isEnabled);
      });

      it('emits an "updated" event with .isEnabled set to false', () => {
        const track = new RemoteTrackPublicationV3({
          kind: makeKind(),
          name: makeUUID(),
          priority: makeUUID(),
          sid: makeSid()
        }, false, null);
        let isEnabled;
        track.once('updated', () => { isEnabled = track.isEnabled; });
        track.disable();
        assert.equal(false, isEnabled);
      });
    });

    context('called when the RemoteTrackPublicationV3 is disabled', () => {
      it('returns the RemoteTrackPublicationV3', () => {
        const track = new RemoteTrackPublicationV3({
          kind: makeKind(),
          name: makeUUID(),
          priority: makeUUID(),
          sid: makeSid()
        }, true, 'DISABLED_BY_PUBLISHER');
        assert.equal(track, track.disable());
      });

      it('.isEnabled remains false', () => {
        const track = new RemoteTrackPublicationV3({
          kind: makeKind(),
          name: makeUUID(),
          priority: makeUUID(),
          sid: makeSid()
        }, true, 'DISABLED_BY_PUBLISHER');
        track.disable();
        assert(!track.isEnabled);
      });

      it('"updated" does not emit', () => {
        const track = new RemoteTrackPublicationV3({
          kind: makeKind(),
          name: makeUUID(),
          priority: makeUUID(),
          sid: makeSid()
        }, true, 'DISABLED_BY_PUBLISHER');
        let updated;
        track.once('updated', () => { updated = true; });
        track.disable();
        assert(!updated);
      });
    });
  });

  describe('#enable', () => {
    context('called with false when the RemoteTrackPublicationV3 is', () => {
      context('enabled', () => {
        it('returns the RemoteTrackPublicationV3', () => {
          const track = new RemoteTrackPublicationV3({
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          }, false, null);
          assert.equal(track, track.enable(false));
        });

        it('sets .isEnabled to false', () => {
          const track = new RemoteTrackPublicationV3({
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          }, false, null);
          track.enable(false);
          assert(!track.isEnabled);
        });

        it('emits an "updated" event with .isEnabled set to false', () => {
          const track = new RemoteTrackPublicationV3({
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          }, false, null);
          let isEnabled;
          track.once('updated', () => { isEnabled = track.isEnabled; });
          track.enable(false);
          assert.equal(false, isEnabled);
        });
      });

      context('disabled', () => {
        it('returns the RemoteTrackPublicationV3', () => {
          const track = new RemoteTrackPublicationV3({
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          }, true, 'DISABLED_BY_PUBLISHER');
          assert.equal(track, track.enable(false));
        });

        it('.isEnabled remains false', () => {
          const track = new RemoteTrackPublicationV3({
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          }, true, 'DISABLED_BY_PUBLISHER');
          track.enable(false);
          assert(!track.isEnabled);
        });

        it('"updated" does not emit', () => {
          const track = new RemoteTrackPublicationV3({
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          }, true, 'DISABLED_BY_PUBLISHER');
          let updated;
          track.once('updated', () => { updated = true; });
          track.enable(false);
          assert(!updated);
        });
      });
    });

    context('called with true when the RemoteTrackPublicationV3 is', () => {
      context('enabled', () => {
        it('returns the RemoteTrackPublicationV3', () => {
          const track = new RemoteTrackPublicationV3({
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          }, false, null);
          assert.equal(track, track.enable(true));
        });

        it('.isEnabled remains true', () => {
          const track = new RemoteTrackPublicationV3({
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          }, false, null);
          track.enable(true);
          assert(track.isEnabled);
        });

        it('"updated" does not emit', () => {
          const track = new RemoteTrackPublicationV3({
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          }, false, null);
          let updated;
          track.once('updated', () => { updated = true; });
          track.enable(true);
          assert(!updated);
        });
      });

      context('disabled', () => {
        it('returns the RemoteTrackPublicationV3', () => {
          const track = new RemoteTrackPublicationV3({
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          }, true, 'DISABLED_BY_PUBLISHER');
          assert.equal(track, track.enable(true));
        });

        it('sets .isEnabled to true', () => {
          const track = new RemoteTrackPublicationV3({
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          }, true, 'DISABLED_BY_PUBLISHER');
          track.enable(true);
          assert(track.isEnabled);
        });

        it('emits an "updated" event with .isEnabled set to true', () => {
          const track = new RemoteTrackPublicationV3({
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          }, true, 'DISABLED_BY_PUBLISHER');
          let isEnabled;
          track.once('updated', () => { isEnabled = track.isEnabled; });
          track.enable(true);
          assert(isEnabled);
        });
      });
    });

    context('called without an argument when the RemoteTrackPublicationV3 is', () => {
      context('enabled', () => {
        it('returns the RemoteTrackPublicationV3', () => {
          const track = new RemoteTrackPublicationV3({
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          }, false, null);
          assert.equal(track, track.enable());
        });

        it('.isEnabled remains true', () => {
          const track = new RemoteTrackPublicationV3({
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          }, false, null);
          track.enable();
          assert(track.isEnabled);
        });

        it('"updated" does not emit', () => {
          const track = new RemoteTrackPublicationV3({
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          }, false, null);
          let updated;
          track.once('updated', () => { updated = true; });
          track.enable();
          assert(!updated);
        });
      });

      context('disabled', () => {
        it('returns the RemoteTrackPublicationV3', () => {
          const track = new RemoteTrackPublicationV3({
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          }, true, 'DISABLED_BY_PUBLISHER');
          assert.equal(track, track.enable());
        });

        it('sets .isEnabled to true', () => {
          const track = new RemoteTrackPublicationV3({
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          }, true, 'DISABLED_BY_PUBLISHER');
          track.enable();
          assert(track.isEnabled);
        });

        it('emits an "updated" event with .isEnabled set to true', () => {
          const track = new RemoteTrackPublicationV3({
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          }, true, 'DISABLED_BY_PUBLISHER');
          let isEnabled;
          track.once('updated', () => { isEnabled = track.isEnabled; });
          track.enable();
          assert(isEnabled);
        });
      });
    });
  });
});

function makeSwitchedOff() {
  const isSwitchedOff = (Math.random() < 0.5);
  const switchOffReasons = ['DISABLED_BY_PUBLISHER', 'DISABLED_BY_SUBSCRIBER'];
  const switchOffReason = isSwitchedOff ? switchOffReasons[Number(Math.random() < 0.5)] : null;
  return { isSwitchedOff, switchOffReason };
}

function makeKind() {
  return ['audio', 'video'][Number(Math.random() > 0.5)];
}

function makeSid() {
  return makeUUID();
}
