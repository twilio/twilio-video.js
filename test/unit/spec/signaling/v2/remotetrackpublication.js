'use strict';

const assert = require('assert');

const RemoteTrackPublicationV2 = require('../../../../../lib/signaling/v2/remotetrackpublication');
const { makeUUID } = require('../../../../../lib/util');

describe('RemoteTrackPublicationV2', () => {
  describe('constructor', () => {
    ['kind', 'name', 'priority', 'sid'].forEach(prop => {
      it(`sets .${prop}`, () => {
        const trackState = {
          enabled: makeEnabled(),
          kind: makeKind(),
          name: makeUUID(),
          priority: makeUUID(),
          sid: makeSid()
        };
        const isSwitchedOff = makeSwitchedOff();
        assert.equal((new RemoteTrackPublicationV2(trackState, isSwitchedOff))[prop], trackState[prop]);
      });
    });

    [true, false].forEach(enabled => {
      context(`when trackState.enabled is ${enabled}`, () => {
        it(`sets .isEnabled to ${enabled}`, () => {
          assert.equal((new RemoteTrackPublicationV2({
            enabled,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          })).isEnabled, enabled);
        });
      });
    });

    [true, false].forEach(isSwitchedOff => {
      context(`when isSwitchedOff is ${isSwitchedOff}`, () => {
        it(`sets .isSwitchedOff to ${isSwitchedOff}`, () => {
          assert.equal((new RemoteTrackPublicationV2({
            enabled: makeEnabled(),
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          }, isSwitchedOff)).isSwitchedOff, isSwitchedOff);
        });
      });
    });
  });

  describe('#update', () => {
    ['low', 'standard', 'high'].forEach(oldPriorityValue => {
      ['low', 'standard', 'high'].forEach(newPriorityValue => {
        context(`called with priority change: ${oldPriorityValue} => ${newPriorityValue}`, () => {
          it('returns the RemoteTrackPublicationV2', () => {
            const trackState = {
              enabled: true,
              kind: makeKind(),
              name: makeUUID(),
              priority: oldPriorityValue,
              sid: makeSid()
            };
            const track = new RemoteTrackPublicationV2(trackState);
            trackState.priority = newPriorityValue;
            assert.equal(track, track.update(trackState));
          });

          it('sets .priority to new value', () => {
            const trackState = {
              enabled: true,
              kind: makeKind(),
              name: makeUUID(),
              priority: oldPriorityValue,
              sid: makeSid()
            };
            const track = new RemoteTrackPublicationV2(trackState);
            trackState.priority = newPriorityValue;
            track.update(trackState);
            assert.equal(track.priority, newPriorityValue);
          });

          if (newPriorityValue !== oldPriorityValue) {
            it('emits an "updated" event with .priority set to newValue', () => {
              const trackState = {
                enabled: true,
                kind: makeKind(),
                name: makeUUID(),
                priority: oldPriorityValue,
                sid: makeSid()
              };

              let priority;
              const track = new RemoteTrackPublicationV2(trackState);
              trackState.priority = newPriorityValue;
              track.once('updated', () => { priority = track.priority; });
              track.update(trackState);
              assert.equal(priority, newPriorityValue);
            });
          } else {
            it('does not emit an "updated" event', () => {
              const trackState = {
                enabled: true,
                kind: makeKind(),
                name: makeUUID(),
                priority: oldPriorityValue,
                sid: makeSid()
              };

              let updated = false;
              const track = new RemoteTrackPublicationV2(trackState);
              trackState.priority = newPriorityValue;
              track.once('updated', () => { updated = true; });
              track.update(trackState);
              assert(!updated);
            });
          }
        });
      });
    });

    context('called with a trackState setting .enabled to false when the RemoteTrackPublicationV2 is', () => {
      context('enabled', () => {
        it('returns the RemoteTrackPublicationV2', () => {
          const trackState = {
            enabled: true,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          };
          const track = new RemoteTrackPublicationV2(trackState);
          trackState.enabled = false;
          assert.equal(track, track.update(trackState));
        });

        it('sets .isEnabled to false', () => {
          const trackState = {
            enabled: true,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          };
          const track = new RemoteTrackPublicationV2(trackState);
          trackState.enabled = false;
          track.update(trackState);
          assert(!track.isEnabled);
        });

        it('emits an "updated" event with .isEnabled set to false', () => {
          const trackState = {
            enabled: true,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          };
          const track = new RemoteTrackPublicationV2(trackState);
          trackState.enabled = false;
          let isEnabled;
          track.once('updated', () => { isEnabled = track.isEnabled; });
          track.update(trackState);
          assert.equal(false, isEnabled);
        });
      });

      context('disabled', () => {
        it('returns the RemoteTrackPublicationV2', () => {
          const trackState = {
            enabled: false,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          };
          const track = new RemoteTrackPublicationV2(trackState);
          trackState.enabled = false;
          assert.equal(track, track.update(trackState));
        });

        it('.isEnabled remains false', () => {
          const trackState = {
            enabled: false,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          };
          const track = new RemoteTrackPublicationV2(trackState);
          trackState.enabled = false;
          track.update(trackState);
          assert(!track.isEnabled);
        });

        it('"updated" does not emit', () => {
          const trackState = {
            enabled: false,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          };
          const track = new RemoteTrackPublicationV2(trackState);
          trackState.enabled = false;
          let updated;
          track.once('updated', () => { updated = true; });
          track.update(trackState);
          assert(!updated);
        });
      });
    });

    context('called with a trackState setting .enabled to true when the RemoteTrackPublicationV2 is', () => {
      context('enabled', () => {
        it('returns the RemoteTrackPublicationV2', () => {
          const trackState = {
            enabled: true,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          };
          const track = new RemoteTrackPublicationV2(trackState);
          trackState.enabled = true;
          assert.equal(track, track.update(trackState));
        });

        it('.isEnabled remains true', () => {
          const trackState = {
            enabled: true,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          };
          const track = new RemoteTrackPublicationV2(trackState);
          trackState.enabled = true;
          track.update(trackState);
          assert(track.isEnabled);
        });

        it('"updated" does not emit', () => {
          const trackState = {
            enabled: true,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          };
          const track = new RemoteTrackPublicationV2(trackState);
          trackState.enabled = true;
          let updated;
          track.once('updated', () => { updated = true; });
          track.update(trackState);
          assert(!updated);
        });
      });

      context('disabled', () => {
        it('returns the RemoteTrackPublicationV2', () => {
          const trackState = {
            enabled: false,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          };
          const track = new RemoteTrackPublicationV2(trackState);
          trackState.enabled = true;
          assert.equal(track, track.update(trackState));
        });

        it('sets .isEnabled to true', () => {
          const trackState = {
            enabled: false,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          };
          const track = new RemoteTrackPublicationV2(trackState);
          trackState.enabled = true;
          track.update(trackState);
          assert(track.isEnabled);
        });

        it('emits an "updated" event with .isEnabled set to true', () => {
          const trackState = {
            enabled: false,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          };
          const track = new RemoteTrackPublicationV2(trackState);
          trackState.enabled = true;
          let isEnabled;
          track.once('updated', () => { isEnabled = track.isEnabled; });
          track.update(trackState);
          assert(isEnabled);
        });
      });
    });
  });

  // TrackSignaling
  // --------------

  describe('#disable', () => {
    context('called when the RemoteTrackPublicationV2 is enabled', () => {
      it('returns the RemoteTrackPublicationV2', () => {
        const track = new RemoteTrackPublicationV2({
          enabled: true,
          kind: makeKind(),
          name: makeUUID(),
          priority: makeUUID(),
          sid: makeSid()
        });
        assert.equal(track, track.disable());
      });

      it('sets .isEnabled to false', () => {
        const track = new RemoteTrackPublicationV2({
          enabled: true,
          kind: makeKind(),
          name: makeUUID(),
          priority: makeUUID(),
          sid: makeSid()
        });
        track.disable();
        assert(!track.isEnabled);
      });

      it('emits an "updated" event with .isEnabled set to false', () => {
        const track = new RemoteTrackPublicationV2({
          enabled: true,
          kind: makeKind(),
          name: makeUUID(),
          priority: makeUUID(),
          sid: makeSid()
        });
        let isEnabled;
        track.once('updated', () => { isEnabled = track.isEnabled; });
        track.disable();
        assert.equal(false, isEnabled);
      });
    });

    context('called when the RemoteTrackPublicationV2 is disabled', () => {
      it('returns the RemoteTrackPublicationV2', () => {
        const track = new RemoteTrackPublicationV2({
          enabled: false,
          kind: makeKind(),
          name: makeUUID(),
          priority: makeUUID(),
          sid: makeSid()
        });
        assert.equal(track, track.disable());
      });

      it('.isEnabled remains false', () => {
        const track = new RemoteTrackPublicationV2({
          enabled: false,
          kind: makeKind(),
          name: makeUUID(),
          priority: makeUUID(),
          sid: makeSid()
        });
        track.disable();
        assert(!track.isEnabled);
      });

      it('"updated" does not emit', () => {
        const track = new RemoteTrackPublicationV2({
          enabled: false,
          kind: makeKind(),
          name: makeUUID(),
          priority: makeUUID(),
          sid: makeSid()
        });
        let updated;
        track.once('updated', () => { updated = true; });
        track.disable();
        assert(!updated);
      });
    });
  });

  describe('#enable', () => {
    context('called with false when the RemoteTrackPublicationV2 is', () => {
      context('enabled', () => {
        it('returns the RemoteTrackPublicationV2', () => {
          const track = new RemoteTrackPublicationV2({
            enabled: true,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          });
          assert.equal(track, track.enable(false));
        });

        it('sets .isEnabled to false', () => {
          const track = new RemoteTrackPublicationV2({
            enabled: true,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          });
          track.enable(false);
          assert(!track.isEnabled);
        });

        it('emits an "updated" event with .isEnabled set to false', () => {
          const track = new RemoteTrackPublicationV2({
            enabled: true,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          });
          let isEnabled;
          track.once('updated', () => { isEnabled = track.isEnabled; });
          track.enable(false);
          assert.equal(false, isEnabled);
        });
      });

      context('disabled', () => {
        it('returns the RemoteTrackPublicationV2', () => {
          const track = new RemoteTrackPublicationV2({
            enabled: false,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          });
          assert.equal(track, track.enable(false));
        });

        it('.isEnabled remains false', () => {
          const track = new RemoteTrackPublicationV2({
            enabled: false,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          });
          track.enable(false);
          assert(!track.isEnabled);
        });

        it('"updated" does not emit', () => {
          const track = new RemoteTrackPublicationV2({
            enabled: false,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          });
          let updated;
          track.once('updated', () => { updated = true; });
          track.enable(false);
          assert(!updated);
        });
      });
    });

    context('called with true when the RemoteTrackPublicationV2 is', () => {
      context('enabled', () => {
        it('returns the RemoteTrackPublicationV2', () => {
          const track = new RemoteTrackPublicationV2({
            enabled: true,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          });
          assert.equal(track, track.enable(true));
        });

        it('.isEnabled remains true', () => {
          const track = new RemoteTrackPublicationV2({
            enabled: true,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          });
          track.enable(true);
          assert(track.isEnabled);
        });

        it('"updated" does not emit', () => {
          const track = new RemoteTrackPublicationV2({
            enabled: true,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          });
          let updated;
          track.once('updated', () => { updated = true; });
          track.enable(true);
          assert(!updated);
        });
      });

      context('disabled', () => {
        it('returns the RemoteTrackPublicationV2', () => {
          const track = new RemoteTrackPublicationV2({
            enabled: false,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          });
          assert.equal(track, track.enable(true));
        });

        it('sets .isEnabled to true', () => {
          const track = new RemoteTrackPublicationV2({
            enabled: false,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          });
          track.enable(true);
          assert(track.isEnabled);
        });

        it('emits an "updated" event with .isEnabled set to true', () => {
          const track = new RemoteTrackPublicationV2({
            enabled: false,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          });
          let isEnabled;
          track.once('updated', () => { isEnabled = track.isEnabled; });
          track.enable(true);
          assert(isEnabled);
        });
      });
    });

    context('called without an argument when the RemoteTrackPublicationV2 is', () => {
      context('enabled', () => {
        it('returns the RemoteTrackPublicationV2', () => {
          const track = new RemoteTrackPublicationV2({
            enabled: true,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          });
          assert.equal(track, track.enable());
        });

        it('.isEnabled remains true', () => {
          const track = new RemoteTrackPublicationV2({
            enabled: true,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          });
          track.enable();
          assert(track.isEnabled);
        });

        it('"updated" does not emit', () => {
          const track = new RemoteTrackPublicationV2({
            enabled: true,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          });
          let updated;
          track.once('updated', () => { updated = true; });
          track.enable();
          assert(!updated);
        });
      });

      context('disabled', () => {
        it('returns the RemoteTrackPublicationV2', () => {
          const track = new RemoteTrackPublicationV2({
            enabled: false,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          });
          assert.equal(track, track.enable());
        });

        it('sets .isEnabled to true', () => {
          const track = new RemoteTrackPublicationV2({
            enabled: false,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          });
          track.enable();
          assert(track.isEnabled);
        });

        it('emits an "updated" event with .isEnabled set to true', () => {
          const track = new RemoteTrackPublicationV2({
            enabled: false,
            kind: makeKind(),
            name: makeUUID(),
            priority: makeUUID(),
            sid: makeSid()
          });
          let isEnabled;
          track.once('updated', () => { isEnabled = track.isEnabled; });
          track.enable();
          assert(isEnabled);
        });
      });
    });
  });

  describe('#setTrackTransceiver', () => {
    it('returns the RemoteTrackPublicationV2', () => {
      const track = new RemoteTrackPublicationV2({
        enabled: makeEnabled(),
        kind: makeKind(),
        name: makeUUID(),
        priority: makeUUID(),
        sid: makeSid()
      });
      const mediaTrackReceiver = {};
      assert.equal(track, track.setTrackTransceiver(mediaTrackReceiver));
    });

    it('emits "updated" with .trackTransceiver set to the given TrackReceiver', () => {
      const track = new RemoteTrackPublicationV2({
        enabled: makeEnabled(),
        kind: makeKind(),
        name: makeUUID(),
        priority: makeUUID(),
        sid: makeSid()
      });
      const mediaTrackReceiver = {};

      let updated;
      track.once('updated', () => { updated = true; });
      track.setTrackTransceiver(mediaTrackReceiver);
      assert(updated);
      assert.equal(track.trackTransceiver, mediaTrackReceiver);
    });
  });
});

function makeEnabled() {
  return (Math.random() < 0.5);
}

function makeSwitchedOff() {
  return (Math.random() < 0.5);
}

function makeKind() {
  return ['audio', 'video'][Number(Math.random() > 0.5)];
}

function makeSid() {
  return makeUUID();
}
