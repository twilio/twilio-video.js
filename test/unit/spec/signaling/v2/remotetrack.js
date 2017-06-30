'use strict';

var assert = require('assert');
var RemoteTrackV2 = require('../../../../../lib/signaling/v2/remotetrack');
var util = require('../../../../../lib/util');

describe('RemoteTrackV2', () => {
  // RemoteTrackV2
  // -------

  describe('constructor', () => {
    it('sets .id', () => {
      var id = makeId();
      assert.equal(id, (new RemoteTrackV2({
        enabled: makeEnabled(),
        id: id,
        kind: makeKind(),
        sid: makeSid(),
        subscribed: makeSubscribed()
      })).id);
    });

    it('sets .sid', () => {
      var sid = makeSid();
      assert.equal(sid, (new RemoteTrackV2({
        enabled: makeEnabled(),
        id: makeId(),
        kind: makeKind(),
        sid: sid,
        subscribed: makeSubscribed()
      })).sid);
    });

    [ true, false ].forEach(isSubscribed => {
      context(`when trackState.subscribed is set to ${isSubscribed}`, () => {
        it(`sets .isSubScribed to ${isSubscribed}`, () => {
          var subscribed = makeSubscribed();
          assert.equal(subscribed, (new RemoteTrackV2({
            enabled: makeEnabled(),
            id: makeId(),
            kind: makeKind(),
            sid: makeSid(),
            subscribed: subscribed
          })).isSubscribed);
        });
      });
    });

    context('when trackState.enabled is true', () => {
      it('sets .isEnabled to true', () => {
        assert((new RemoteTrackV2({
          enabled: true,
          id: makeId(),
          kind: makeKind(),
          sid: makeSid(),
          subscribed: makeSubscribed()
        })).isEnabled);
      });
    });

    context('when trackState.enabled is false', () => {
      it('sets .isEnabled to false', () => {
        assert(!(new RemoteTrackV2({
          enabled: false,
          id: makeId(),
          kind: makeKind(),
          sid: makeSid(),
          subscribed: makeSubscribed()
        })).isEnabled);
      });
    });

    context('when trackState.kind is "audio"', () => {
      it('sets .kind to "audio"', () => {
        assert.equal('audio', (new RemoteTrackV2({
          enabled: makeEnabled(),
          id: makeId(),
          kind: 'audio',
          sid: makeSid(),
          subscribed: makeSubscribed()
        })).kind);
      });
    });

    context('when trackState.kind is "video"', () => {
      it('sets .kind to "video"', () => {
        assert.equal('video', (new RemoteTrackV2({
          enabled: makeEnabled(),
          id: makeId(),
          kind: 'video',
          sid: makeSid(),
          subscribed: makeSubscribed()
        })).kind);
      });
    });
  });

  describe('#update', () => {
    context('called with a trackState setting .enabled to false when the RemoteTrackV2 is', () => {
      context('enabled', () => {
        it('returns the RemoteTrackV2', () => {
          var trackState = {
            id: makeId(),
            enabled: true,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          };
          var track = new RemoteTrackV2(trackState);
          trackState.enabled = false;
          assert.equal(track, track.update(trackState));
        });

        it('sets .isEnabled to false', () => {
          var trackState = {
            id: makeId(),
            enabled: true,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          };
          var track = new RemoteTrackV2(trackState);
          trackState.enabled = false;
          track.update(trackState);
          assert(!track.isEnabled);
        });

        it('emits an "updated" event with .isEnabled set to false', () => {
          var trackState = {
            id: makeId(),
            enabled: true,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          };
          var track = new RemoteTrackV2(trackState);
          trackState.enabled = false;
          var isEnabled;
          track.once('updated', () => isEnabled = track.isEnabled);
          track.update(trackState);
          assert.equal(false, isEnabled);
        });
      });

      context('disabled', () => {
        it('returns the RemoteTrackV2', () => {
          var trackState = {
            id: makeId(),
            enabled: false,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          };
          var track = new RemoteTrackV2(trackState);
          trackState.enabled = false;
          assert.equal(track, track.update(trackState));
        });

        it('.isEnabled remains false', () => {
          var trackState = {
            id: makeId(),
            enabled: false,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          };
          var track = new RemoteTrackV2(trackState);
          trackState.enabled = false;
          track.update(trackState);
          assert(!track.isEnabled);
        });

        it('"updated" does not emit', () => {
          var trackState = {
            id: makeId(),
            enabled: false,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          };
          var track = new RemoteTrackV2(trackState);
          trackState.enabled = false;
          var updated = false;
          track.once('updated', () => updated = true);
          track.update(trackState);
          assert(!updated);
        });
      });
    });

    context('called with a trackState setting .enabled to true when the RemoteTrackV2 is', () => {
      context('enabled', () => {
        it('returns the RemoteTrackV2', () => {
          var trackState = {
            id: makeId(),
            enabled: true,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          };
          var track = new RemoteTrackV2(trackState);
          trackState.enabled = true;
          assert.equal(track, track.update(trackState));
        });

        it('.isEnabled remains true', () => {
          var trackState = {
            id: makeId(),
            enabled: true,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          };
          var track = new RemoteTrackV2(trackState);
          trackState.enabled = true;
          track.update(trackState);
          assert(track.isEnabled);
        });

        it('"updated" does not emit', () => {
          var trackState = {
            id: makeId(),
            enabled: true,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          };
          var track = new RemoteTrackV2(trackState);
          trackState.enabled = true;
          var updated = false;
          track.once('updated', () => updated = true);
          track.update(trackState);
          assert(!updated);
        });
      });

      context('disabled', () => {
        it('returns the RemoteTrackV2', () => {
          var trackState = {
            id: makeId(),
            enabled: false,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          };
          var track = new RemoteTrackV2(trackState);
          trackState.enabled = true;
          assert.equal(track, track.update(trackState));
        });

        it('sets .isEnabled to true', () => {
          var trackState = {
            id: makeId(),
            enabled: false,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          };
          var track = new RemoteTrackV2(trackState);
          trackState.enabled = true;
          track.update(trackState);
          assert(track.isEnabled);
        });

        it('emits an "updated" event with .isEnabled set to true', () => {
          var trackState = {
            id: makeId(),
            enabled: false,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          };
          var track = new RemoteTrackV2(trackState);
          trackState.enabled = true;
          var isEnabled;
          track.once('updated', () => isEnabled = track.isEnabled);
          track.update(trackState);
          assert(isEnabled);
        });
      });
    });
  });

  // TrackSignaling
  // --------------

  describe('#disable', () => {
    context('called when the RemoteTrackV2 is enabled', () => {
      it('returns the RemoteTrackV2', () => {
        var track = new RemoteTrackV2({
          id: makeId(),
          enabled: true,
          kind: makeKind(),
          sid: makeSid(),
          subscribed: makeSubscribed()
        });
        assert.equal(track, track.disable());
      });

      it('sets .isEnabled to false', () => {
        var track = new RemoteTrackV2({
          id: makeId(),
          enabled: true,
          kind: makeKind(),
          sid: makeSid(),
          subscribed: makeSubscribed()
        });
        track.disable();
        assert(!track.isEnabled);
      });

      it('emits an "updated" event with .isEnabled set to false', () => {
        var track = new RemoteTrackV2({
          id: makeId(),
          enabled: true,
          kind: makeKind(),
          sid: makeSid(),
          subscribed: makeSubscribed()
        });
        var isEnabled;
        track.once('updated', () => isEnabled = track.isEnabled);
        track.disable();
        assert.equal(false, isEnabled);
      });
    });

    context('called when the RemoteTrackV2 is disabled', () => {
      it('returns the RemoteTrackV2', () => {
        var track = new RemoteTrackV2({
          id: makeId(),
          enabled: false,
          kind: makeKind(),
          sid: makeSid(),
          subscribed: makeSubscribed()
        });
        assert.equal(track, track.disable());
      });

      it('.isEnabled remains false', () => {
        var track = new RemoteTrackV2({
          id: makeId(),
          enabled: false,
          kind: makeKind(),
          sid: makeSid(),
          subscribed: makeSubscribed()
        });
        track.disable();
        assert(!track.isEnabled);
      });

      it('"updated" does not emit', () => {
        var track = new RemoteTrackV2({
          id: makeId(),
          enabled: false,
          kind: makeKind(),
          sid: makeSid(),
          subscribed: makeSubscribed()
        });
        var updated = false;
        track.once('updated', () => updated = true);
        track.disable();
        assert(!updated);
      });
    });
  });

  describe('#enable', () => {
    context('called with false when the RemoteTrackV2 is', () => {
      context('enabled', () => {
        it('returns the RemoteTrackV2', () => {
          var track = new RemoteTrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          });
          assert.equal(track, track.enable(false));
        });

        it('sets .isEnabled to false', () => {
          var track = new RemoteTrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          });
          track.enable(false);
          assert(!track.isEnabled);
        });

        it('emits an "updated" event with .isEnabled set to false', () => {
          var track = new RemoteTrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          });
          var isEnabled;
          track.once('updated', () => isEnabled = track.isEnabled);
          track.enable(false);
          assert.equal(false, isEnabled);
        });
      });

      context('disabled', () => {
        it('returns the RemoteTrackV2', () => {
          var track = new RemoteTrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          });
          assert.equal(track, track.enable(false));
        });

        it('.isEnabled remains false', () => {
          var track = new RemoteTrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          });
          track.enable(false);
          assert(!track.isEnabled);
        });

        it('"updated" does not emit', () => {
          var track = new RemoteTrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          });
          var updated = false;
          track.once('updated', () => updated = true);
          track.enable(false);
          assert(!updated);
        });
      });
    });

    context('called with true when the RemoteTrackV2 is', () => {
      context('enabled', () => {
        it('returns the RemoteTrackV2', () => {
          var track = new RemoteTrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          });
          assert.equal(track, track.enable(true));
        });

        it('.isEnabled remains true', () => {
          var track = new RemoteTrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          });
          track.enable(true);
          assert(track.isEnabled);
        });

        it('"updated" does not emit', () => {
          var track = new RemoteTrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          });
          var updated = false;
          track.once('updated', () => updated = true);
          track.enable(true);
          assert(!updated);
        });
      });

      context('disabled', () => {
        it('returns the RemoteTrackV2', () => {
          var track = new RemoteTrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          });
          assert.equal(track, track.enable(true));
        });

        it('sets .isEnabled to true', () => {
          var track = new RemoteTrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          });
          track.enable(true);
          assert(track.isEnabled);
        });

        it('emits an "updated" event with .isEnabled set to true', () => {
          var track = new RemoteTrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          });
          var isEnabled;
          track.once('updated', () => isEnabled = track.isEnabled);
          track.enable(true);
          assert(isEnabled);
        });
      });
    });

    context('called without an argument when the RemoteTrackV2 is', () => {
      context('enabled', () => {
        it('returns the RemoteTrackV2', () => {
          var track = new RemoteTrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          });
          assert.equal(track, track.enable());
        });

        it('.isEnabled remains true', () => {
          var track = new RemoteTrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          });
          track.enable();
          assert(track.isEnabled);
        });

        it('"updated" does not emit', () => {
          var track = new RemoteTrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          });
          var updated = false;
          track.once('updated', () => updated = true);
          track.enable();
          assert(!updated);
        });
      });

      context('disabled', () => {
        it('returns the RemoteTrackV2', () => {
          var track = new RemoteTrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          });
          assert.equal(track, track.enable());
        });

        it('sets .isEnabled to true', () => {
          var track = new RemoteTrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          });
          track.enable();
          assert(track.isEnabled);
        });

        it('emits an "updated" event with .isEnabled set to true', () => {
          var track = new RemoteTrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind(),
            sid: makeSid(),
            subscribed: makeSubscribed()
          });
          var isEnabled;
          track.once('updated', () => isEnabled = track.isEnabled);
          track.enable();
          assert(isEnabled);
        });
      });
    });
  });

  describe('#getMediaStreamTrack', () => {
    context('called after setMediaStreamTrack', () => {
      it('returns a Promise that resolves to the MediaStreamTrack passed to setMediaStreamTrack', () => {
        var track = new RemoteTrackV2({
          id: makeId(),
          enabled: makeEnabled(),
          kind: makeKind(),
          sid: makeSid(),
          subscribed: makeSubscribed()
        });
        var mediaStreamTrack = {};
        track.setMediaStreamTrack(mediaStreamTrack);
        return track.getMediaStreamTrack().then(track => {
          assert.equal(mediaStreamTrack, track);
        });
      });
    });

    context('called before setMediaStreamTrack', () => {
      it('returns a Promise that resolves to the MediaStreamTrack eventually passed to setMediaStreamTrack', () => {
        var track = new RemoteTrackV2({
          id: makeId(),
          enabled: makeEnabled(),
          kind: makeKind(),
          sid: makeSid(),
          subscribed: makeSubscribed()
        });
        var mediaStreamTrack = {};
        var promise = track.getMediaStreamTrack().then(track => {
          assert.equal(mediaStreamTrack, track);
        });
        track.setMediaStreamTrack(mediaStreamTrack);
        return promise;
      });
    });
  });

  describe('#setMediaStreamTrack', () => {
    it('returns the RemoteTrackV2', () => {
      var track = new RemoteTrackV2({
        id: makeId(),
        enabled: makeEnabled(),
        kind: makeKind(),
        sid: makeSid(),
        subscribed: makeSubscribed()
      });
      var mediaStreamTrack = {};
      assert.equal(track, track.setMediaStreamTrack(mediaStreamTrack));
    });
  });
});

function makeEnabled() {
  return (Math.random() < 0.5);
}

function makeId() {
  return util.makeUUID();
}

function makeKind() {
  return ['audio', 'video'][Number(Math.random() > 0.5)];
}

function makeSid() {
  return util.makeUUID();
}

function makeSubscribed() {
  return (Math.random() < 0.5);
}
