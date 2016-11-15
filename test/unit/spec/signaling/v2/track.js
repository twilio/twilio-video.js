'use strict';

var assert = require('assert');
var TrackV2 = require('../../../../../lib/signaling/v2/track');
var util = require('../../../../../lib/util');

describe('TrackV2', () => {
  // TrackV2
  // -------

  describe('constructor', () => {
    it('sets .id', () => {
      var id = makeId();
      assert.equal(id, (new TrackV2({
        enabled: makeEnabled(),
        id: id,
        kind: makeKind()
      })).id);
    });

    context('when trackState.enabled is true', () => {
      it('sets .isEnabled to true', () => {
        assert((new TrackV2({
          enabled: true,
          id: makeId(),
          kind: makeKind()
        })).isEnabled);
      });
    });

    context('when trackState.enabled is false', () => {
      it('sets .isEnabled to false', () => {
        assert(!(new TrackV2({
          enabled: false,
          id: makeId(),
          kind: makeKind()
        })).isEnabled);
      });
    });

    context('when trackState.kind is "audio"', () => {
      it('sets .kind to "audio"', () => {
        assert.equal('audio', (new TrackV2({
          enabled: makeEnabled(),
          id: makeId(),
          kind: 'audio'
        })).kind);
      });
    });

    context('when trackState.kind is "video"', () => {
      it('sets .kind to "video"', () => {
        assert.equal('video', (new TrackV2({
          enabled: makeEnabled(),
          id: makeId(),
          kind: 'video'
        })).kind);
      });
    });
  });

  describe('#getState', () => {
    it('returns an object with .id equal to the Track\'s ID', () => {
      var id = makeId();
      assert.equal(id, TrackV2.getState(new TrackV2({
        id: id,
        enabled: makeEnabled(),
        kind: makeKind()
      })).id);
    });

    context('when the Track is enabled', () => {
      it('returns an object with .enabled set to true', () => {
        assert.equal(true, TrackV2.getState(new TrackV2({
          id: makeId(),
          enabled: true,
          kind: makeKind()
        })).enabled);
      });
    });

    context('when the Track is disabled', () => {
      it('returns an object with .enabled set to false', () => {
        assert.equal(false, TrackV2.getState(new TrackV2({
          id: makeId(),
          enabled: false,
          kind: makeKind()
        })).enabled);
      });
    });

    context('when the Track\'s .kind is "audio"', () => {
      it('returns an object with .kind set to "audio"', () => {
        assert.equal('audio', TrackV2.getState(new TrackV2({
          id: makeId(),
          enabled: makeEnabled(),
          kind: 'audio'
        })).kind);
      });
    });

    context('when the Track\'s .kind is "video"', () => {
      it('returns an object with .kind set to "video"', () => {
        assert.equal('video', TrackV2.getState(new TrackV2({
          id: makeId(),
          enabled: makeEnabled(),
          kind: 'video'
        })).kind);
      });
    });
  });

  describe('#update', () => {
    context('called with a trackState setting .enabled to false when the TrackV2 is', () => {
      context('enabled', () => {
        it('returns the TrackV2', () => {
          var trackState = {
            id: makeId(),
            enabled: true,
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = false;
          assert.equal(track, track.update(trackState));
        });

        it('sets .isEnabled to false', () => {
          var trackState = {
            id: makeId(),
            enabled: true,
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = false;
          track.update(trackState);
          assert(!track.isEnabled);
        });

        it('emits an "updated" event with .isEnabled set to false', () => {
          var trackState = {
            id: makeId(),
            enabled: true,
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = false;
          var isEnabled;
          track.once('updated', () => isEnabled = track.isEnabled);
          track.update(trackState);
          assert.equal(false, isEnabled);
        });
      });

      context('disabled', () => {
        it('returns the TrackV2', () => {
          var trackState = {
            id: makeId(),
            enabled: false,
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = false;
          assert.equal(track, track.update(trackState));
        });

        it('.isEnabled remains false', () => {
          var trackState = {
            id: makeId(),
            enabled: false,
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = false;
          track.update(trackState);
          assert(!track.isEnabled);
        });

        it('"updated" does not emit', () => {
          var trackState = {
            id: makeId(),
            enabled: false,
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = false;
          var updated = false;
          track.once('updated', () => updated = true);
          track.update(trackState);
          assert(!updated);
        });
      });
    });

    context('called with a trackState setting .enabled to true when the TrackV2 is', () => {
      context('enabled', () => {
        it('returns the TrackV2', () => {
          var trackState = {
            id: makeId(),
            enabled: true,
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = true;
          assert.equal(track, track.update(trackState));
        });

        it('.isEnabled remains true', () => {
          var trackState = {
            id: makeId(),
            enabled: true,
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = true;
          track.update(trackState);
          assert(track.isEnabled);
        });

        it('"updated" does not emit', () => {
          var trackState = {
            id: makeId(),
            enabled: true,
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = true;
          var updated = false;
          track.once('updated', () => updated = true);
          track.update(trackState);
          assert(!updated);
        });
      });

      context('disabled', () => {
        it('returns the TrackV2', () => {
          var trackState = {
            id: makeId(),
            enabled: false,
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = true;
          assert.equal(track, track.update(trackState));
        });

        it('sets .isEnabled to true', () => {
          var trackState = {
            id: makeId(),
            enabled: false,
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = true;
          track.update(trackState);
          assert(track.isEnabled);
        });

        it('emits an "updated" event with .isEnabled set to true', () => {
          var trackState = {
            id: makeId(),
            enabled: false,
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
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
    context('called when the TrackV2 is enabled', () => {
      it('returns the TrackV2', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: true,
          kind: makeKind()
        });
        assert.equal(track, track.disable());
      });

      it('sets .isEnabled to false', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: true,
          kind: makeKind()
        });
        track.disable();
        assert(!track.isEnabled);
      });

      it('emits an "updated" event with .isEnabled set to false', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: true,
          kind: makeKind()
        });
        var isEnabled;
        track.once('updated', () => isEnabled = track.isEnabled);
        track.disable();
        assert.equal(false, isEnabled);
      });
    });

    context('called when the TrackV2 is disabled', () => {
      it('returns the TrackV2', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: false,
          kind: makeKind()
        });
        assert.equal(track, track.disable());
      });

      it('.isEnabled remains false', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: false,
          kind: makeKind()
        });
        track.disable();
        assert(!track.isEnabled);
      });

      it('"updated" does not emit', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: false,
          kind: makeKind()
        });
        var updated = false;
        track.once('updated', () => updated = true);
        track.disable();
        assert(!updated);
      });
    });
  });

  describe('#enable', () => {
    context('called with false when the TrackV2 is', () => {
      context('enabled', () => {
        it('returns the TrackV2', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind()
          });
          assert.equal(track, track.enable(false));
        });

        it('sets .isEnabled to false', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind()
          });
          track.enable(false);
          assert(!track.isEnabled);
        });

        it('emits an "updated" event with .isEnabled set to false', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind()
          });
          var isEnabled;
          track.once('updated', () => isEnabled = track.isEnabled);
          track.enable(false);
          assert.equal(false, isEnabled);
        });
      });

      context('disabled', () => {
        it('returns the TrackV2', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind()
          });
          assert.equal(track, track.enable(false));
        });

        it('.isEnabled remains false', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind()
          });
          track.enable(false);
          assert(!track.isEnabled);
        });

        it('"updated" does not emit', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind()
          });
          var updated = false;
          track.once('updated', () => updated = true);
          track.enable(false);
          assert(!updated);
        });
      });
    });

    context('called with true when the TrackV2 is', () => {
      context('enabled', () => {
        it('returns the TrackV2', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind()
          });
          assert.equal(track, track.enable(true));
        });

        it('.isEnabled remains true', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind()
          });
          track.enable(true);
          assert(track.isEnabled);
        });

        it('"updated" does not emit', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind()
          });
          var updated = false;
          track.once('updated', () => updated = true);
          track.enable(true);
          assert(!updated);
        });
      });

      context('disabled', () => {
        it('returns the TrackV2', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind()
          });
          assert.equal(track, track.enable(true));
        });

        it('sets .isEnabled to true', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind()
          });
          track.enable(true);
          assert(track.isEnabled);
        });

        it('emits an "updated" event with .isEnabled set to true', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind()
          });
          var isEnabled;
          track.once('updated', () => isEnabled = track.isEnabled);
          track.enable(true);
          assert(isEnabled);
        });
      });
    });

    context('called without an argument when the TrackV2 is', () => {
      context('enabled', () => {
        it('returns the TrackV2', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind()
          });
          assert.equal(track, track.enable());
        });

        it('.isEnabled remains true', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind()
          });
          track.enable();
          assert(track.isEnabled);
        });

        it('"updated" does not emit', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind()
          });
          var updated = false;
          track.once('updated', () => updated = true);
          track.enable();
          assert(!updated);
        });
      });

      context('disabled', () => {
        it('returns the TrackV2', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind()
          });
          assert.equal(track, track.enable());
        });

        it('sets .isEnabled to true', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind()
          });
          track.enable();
          assert(track.isEnabled);
        });

        it('emits an "updated" event with .isEnabled set to true', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind()
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
      it('returns a Promise that resolves to the pair of MediaStreamTrack and MediaStream passed to setMediaStreamTrack', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: makeEnabled(),
          kind: makeKind()
        });
        var mediaStreamTrack = {};
        var mediaStream = {};
        track.setMediaStreamTrack(mediaStreamTrack, mediaStream);
        return track.getMediaStreamTrack().then(pair => {
          assert.equal(mediaStreamTrack, pair[0]);
          assert.equal(mediaStream, pair[1]);
        });
      });
    });

    context('called before setMediaStreamTrack', () => {
      it('returns a Promise that resolves to the pair of MediaStreamTrack and MediaStream eventually passed to setMediaStreamTrack', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: makeEnabled(),
          kind: makeKind()
        });
        var mediaStreamTrack = {};
        var mediaStream = {};
        var promise = track.getMediaStreamTrack().then(pair => {
          assert.equal(mediaStreamTrack, pair[0]);
          assert.equal(mediaStream, pair[1]);
        });
        track.setMediaStreamTrack(mediaStreamTrack, mediaStream);
        return promise;
      });
    });
  });

  describe('#setMediaStreamTrack', () => {
    it('returns the TrackV2', () => {
      var track = new TrackV2({
        id: makeId(),
        enabled: makeEnabled(),
        kind: makeKind()
      });
      var mediaStreamTrack = {};
      var mediaStream = {};
      assert.equal(track, track.setMediaStreamTrack(mediaStreamTrack, mediaStream));
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
