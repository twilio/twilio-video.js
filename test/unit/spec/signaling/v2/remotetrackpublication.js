'use strict';

const assert = require('assert');

const RemoteTrackPublicationV2 = require('../../../../../lib/signaling/v2/remotetrackpublication');
const { makeUUID } = require('../../../../../lib/util');

describe('RemoteTrackPublicationV2', () => {
  // RemoteTrackPublicationV2
  // -------

  describe('constructor', () => {
    it('sets .name', () => {
      const name = makeUUID();
      assert.equal(name, (new RemoteTrackPublicationV2({
        enabled: makeEnabled(),
        kind: makeKind(),
        name: name,
        sid: makeSid()
      })).name);
    });

    it('sets .sid', () => {
      const sid = makeSid();
      assert.equal(sid, (new RemoteTrackPublicationV2({
        enabled: makeEnabled(),
        kind: makeKind(),
        name: makeUUID(),
        sid: sid
      })).sid);
    });

    context('when trackState.enabled is true', () => {
      it('sets .isEnabled to true', () => {
        assert((new RemoteTrackPublicationV2({
          enabled: true,
          kind: makeKind(),
          name: makeUUID(),
          sid: makeSid()
        })).isEnabled);
      });
    });

    context('when trackState.enabled is false', () => {
      it('sets .isEnabled to false', () => {
        assert(!(new RemoteTrackPublicationV2({
          enabled: false,
          kind: makeKind(),
          name: makeUUID(),
          sid: makeSid()
        })).isEnabled);
      });
    });

    context('when trackState.kind is "audio"', () => {
      it('sets .kind to "audio"', () => {
        assert.equal('audio', (new RemoteTrackPublicationV2({
          enabled: makeEnabled(),
          kind: 'audio',
          name: makeUUID(),
          sid: makeSid()
        })).kind);
      });
    });

    context('when trackState.kind is "video"', () => {
      it('sets .kind to "video"', () => {
        assert.equal('video', (new RemoteTrackPublicationV2({
          enabled: makeEnabled(),
          kind: 'video',
          name: makeUUID(),
          sid: makeSid()
        })).kind);
      });
    });
  });

  describe('#update', () => {
    context('called with a trackState setting .enabled to false when the RemoteTrackPublicationV2 is', () => {
      context('enabled', () => {
        it('returns the RemoteTrackPublicationV2', () => {
          const trackState = {
            enabled: true,
            kind: makeKind(),
            name: makeUUID(),
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
          sid: makeSid()
        });
        assert.equal(track, track.disable());
      });

      it('sets .isEnabled to false', () => {
        const track = new RemoteTrackPublicationV2({
          enabled: true,
          kind: makeKind(),
          name: makeUUID(),
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
          sid: makeSid()
        });
        assert.equal(track, track.disable());
      });

      it('.isEnabled remains false', () => {
        const track = new RemoteTrackPublicationV2({
          enabled: false,
          kind: makeKind(),
          name: makeUUID(),
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
            sid: makeSid()
          });
          assert.equal(track, track.enable(false));
        });

        it('sets .isEnabled to false', () => {
          const track = new RemoteTrackPublicationV2({
            enabled: true,
            kind: makeKind(),
            name: makeUUID(),
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
            sid: makeSid()
          });
          assert.equal(track, track.enable(false));
        });

        it('.isEnabled remains false', () => {
          const track = new RemoteTrackPublicationV2({
            enabled: false,
            kind: makeKind(),
            name: makeUUID(),
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
            sid: makeSid()
          });
          assert.equal(track, track.enable(true));
        });

        it('.isEnabled remains true', () => {
          const track = new RemoteTrackPublicationV2({
            enabled: true,
            kind: makeKind(),
            name: makeUUID(),
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
            sid: makeSid()
          });
          assert.equal(track, track.enable(true));
        });

        it('sets .isEnabled to true', () => {
          const track = new RemoteTrackPublicationV2({
            enabled: false,
            kind: makeKind(),
            name: makeUUID(),
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
            sid: makeSid()
          });
          assert.equal(track, track.enable());
        });

        it('.isEnabled remains true', () => {
          const track = new RemoteTrackPublicationV2({
            enabled: true,
            kind: makeKind(),
            name: makeUUID(),
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
            sid: makeSid()
          });
          assert.equal(track, track.enable());
        });

        it('sets .isEnabled to true', () => {
          const track = new RemoteTrackPublicationV2({
            enabled: false,
            kind: makeKind(),
            name: makeUUID(),
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

function makeKind() {
  return ['audio', 'video'][Number(Math.random() > 0.5)];
}

function makeSid() {
  return makeUUID();
}
