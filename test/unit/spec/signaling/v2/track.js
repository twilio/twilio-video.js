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
      it('sets .state to "disabled"', () => {
        assert.equal('enabled', (new TrackV2({
          enabled: true,
          id: makeId(),
          kind: makeKind()
        })).state);
      });
    });

    context('when trackState.enabled is false', () => {
      it('sets .state to "disabled"', () => {
        assert.equal('disabled', (new TrackV2({
          enabled: false,
          id: makeId(),
          kind: makeKind()
        })).state);
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

    context('when the Track\'s .state is "enabled"', () => {
      it('returns an object with .enabled set to true', () => {
        assert.equal(true, TrackV2.getState(new TrackV2({
          id: makeId(),
          enabled: true,
          kind: makeKind()
        })).enabled);
      });
    });

    context('when the Track\'s .state is "disabled"', () => {
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
    context('called with a trackState setting .enabled to false when the TrackV2\'s .state is', () => {
      context('"enabled"', () => {
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

        it('sets .state to "disabled"', () => {
          var trackState = {
            id: makeId(),
            enabled: true,
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = false;
          track.update(trackState);
          assert.equal('disabled', track.state);
        });

        it('emits a "stateChanged" event with the new state "disabled"', () => {
          var trackState = {
            id: makeId(),
            enabled: true,
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = false;
          var newState;
          track.once('stateChanged', _newState => newState = _newState);
          track.update(trackState);
          assert.equal('disabled', newState);
        });
      });

      context('"ended"', () => {
        it('returns the TrackV2', () => {
          var trackState = {
            id: makeId(),
            enabled: makeEnabled(),
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = false;
          track.end();
          assert.equal(track, track.update(trackState));
        });

        it('.state remains "ended"', () => {
          var trackState = {
            id: makeId(),
            enabled: makeEnabled(),
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = false;
          track.end();
          track.update(trackState);
          assert.equal('ended', track.state);
        });

        it('"stateChanged" does not emit', () => {
          var trackState = {
            id: makeId(),
            enabled: makeEnabled(),
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = false;
          track.end();
          var stateChanged = false;
          track.once('stateChanged', () => stateChanged = true);
          track.update(trackState);
          assert(!stateChanged);
        });
      });

      context('"disabled"', () => {
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

        it('.state remains "disabled"', () => {
          var trackState = {
            id: makeId(),
            enabled: false,
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = false;
          track.update(trackState);
          assert.equal('disabled', track.state);
        });

        it('"stateChanged" does not emit', () => {
          var trackState = {
            id: makeId(),
            enabled: false,
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = false;
          var stateChanged = false;
          track.once('stateChanged', () => stateChanged = true);
          track.update(trackState);
          assert(!stateChanged);
        });
      });
    });

    context('called with a trackState setting .enabled to true when the TrackV2\'s .state is', () => {
      context('"enabled"', () => {
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

        it('.state remains "enabled"', () => {
          var trackState = {
            id: makeId(),
            enabled: true,
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = true;
          track.update(trackState);
          assert.equal('enabled', track.state);
        });

        it('"stateChanged" does not emit', () => {
          var trackState = {
            id: makeId(),
            enabled: true,
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = true;
          var stateChanged = false;
          track.once('stateChanged', () => stateChanged = true);
          track.update(trackState);
          assert(!stateChanged);
        });
      });

      context('"ended"', () => {
        it('returns the TrackV2', () => {
          var trackState = {
            id: makeId(),
            enabled: makeEnabled(),
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = true;
          track.end();
          assert.equal(track, track.update(trackState));
        });

        it('.state remains "ended"', () => {
          var trackState = {
            id: makeId(),
            enabled: makeEnabled(),
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = true;
          track.end();
          track.update(trackState);
          assert.equal('ended', track.state);
        });

        it('"stateChanged" does not emit', () => {
          var trackState = {
            id: makeId(),
            enabled: makeEnabled(),
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = true;
          track.end();
          var stateChanged = false;
          track.once('stateChanged', () => stateChanged = true);
          track.update(trackState);
          assert(!stateChanged);
        });
      });

      context('"disabled"', () => {
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

        it('sets .state to "enabled"', () => {
          var trackState = {
            id: makeId(),
            enabled: false,
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = true;
          track.update(trackState);
          assert.equal('enabled', track.state);
        });

        it('emits a "stateChanged" event with the new state "enabled"', () => {
          var trackState = {
            id: makeId(),
            enabled: false,
            kind: makeKind()
          };
          var track = new TrackV2(trackState);
          trackState.enabled = true;
          var newState;
          track.once('stateChanged', _newState => newState = _newState);
          track.update(trackState);
          assert.equal('enabled', newState);
        });
      });
    });
  });

  // TrackSignaling
  // --------------

  describe('#disable', () => {
    context('called when the TrackV2\'s .state is "enabled"', () => {
      it('returns the TrackV2', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: true,
          kind: makeKind()
        });
        assert.equal(track, track.disable());
      });

      it('sets .state to "disabled"', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: true,
          kind: makeKind()
        });
        track.disable();
        assert.equal('disabled', track.state);
      });

      it('emits a "stateChanged" event with the new state "disabled"', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: true,
          kind: makeKind()
        });
        var newState;
        track.once('stateChanged', _newState => newState = _newState);
        track.disable();
        assert.equal('disabled', newState);
      });
    });

    context('called when the TrackV2\'s .state is "ended"', () => {
      it('returns the TrackV2', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: makeEnabled(),
          kind: makeKind()
        });
        track.end();
        assert.equal(track, track.disable());
      });

      it('.state remains "ended"', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: makeEnabled(),
          kind: makeKind()
        });
        track.end();
        track.disable();
        assert.equal('ended', track.state);
      });

      it('"stateChanged" does not emit', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: makeEnabled(),
          kind: makeKind()
        });
        track.end();
        var stateChanged = false;
        track.once('stateChanged', () => stateChanged = true);
        track.disable();
        assert(!stateChanged);
      });
    });

    context('called when the TrackV2\'s .state is "disabled"', () => {
      it('returns the TrackV2', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: false,
          kind: makeKind()
        });
        assert.equal(track, track.disable());
      });

      it('.state remains "disabled"', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: false,
          kind: makeKind()
        });
        track.disable();
        assert.equal('disabled', track.state);
      });

      it('"stateChanged" does not emit', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: false,
          kind: makeKind()
        });
        var stateChanged = false;
        track.once('stateChanged', () => stateChanged = true);
        track.disable();
        assert(!stateChanged);
      });
    });
  });

  describe('#enable', () => {
    context('called with false when the TrackV2\'s .state is', () => {
      context('"enabled"', () => {
        it('returns the TrackV2', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind()
          });
          assert.equal(track, track.enable(false));
        });

        it('sets .state to "disabled"', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind()
          });
          track.enable(false);
          assert.equal('disabled', track.state);
        });

        it('emits a "stateChanged" event with the new state "disabled"', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind()
          });
          var newState;
          track.once('stateChanged', _newState => newState = _newState);
          track.enable(false);
          assert.equal('disabled', newState);
        });
      });

      context('"ended"', () => {
        it('returns the TrackV2', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: makeEnabled(),
            kind: makeKind()
          });
          track.end();
          assert.equal(track, track.enable(false));
        });

        it('.state remains "ended"', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: makeEnabled(),
            kind: makeKind()
          });
          track.end();
          track.enable(false);
          assert.equal('ended', track.state);
        });

        it('"stateChanged" does not emit', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: makeEnabled(),
            kind: makeKind()
          });
          track.end();
          var stateChanged = false;
          track.once('stateChanged', () => stateChanged = true);
          track.enable(false);
          assert(!stateChanged);
        });
      });

      context('"disabled"', () => {
        it('returns the TrackV2', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind()
          });
          assert.equal(track, track.enable(false));
        });

        it('.state remains "disabled"', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind()
          });
          track.enable(false);
          assert.equal('disabled', track.state);
        });

        it('"stateChanged" does not emit', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind()
          });
          var stateChanged = false;
          track.once('stateChanged', () => stateChanged = true);
          track.enable(false);
          assert(!stateChanged);
        });
      });
    });

    context('called with true when the TrackV2\'s .state is', () => {
      context('"enabled"', () => {
        it('returns the TrackV2', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind()
          });
          assert.equal(track, track.enable(true));
        });

        it('.state remains "enabled"', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind()
          });
          track.enable(true);
          assert.equal('enabled', track.state);
        });

        it('"stateChanged" does not emit', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind()
          });
          var stateChanged = false;
          track.once('stateChanged', () => stateChanged = true);
          track.enable(true);
          assert(!stateChanged);
        });
      });

      context('"ended"', () => {
        it('returns the TrackV2', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: makeEnabled(),
            kind: makeKind()
          });
          track.end();
          assert.equal(track, track.enable(true));
        });

        it('.state remains "ended"', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: makeEnabled(),
            kind: makeKind()
          });
          track.end();
          track.enable(true);
          assert.equal('ended', track.state);
        });

        it('"stateChanged" does not emit', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: makeEnabled(),
            kind: makeKind()
          });
          track.end();
          var stateChanged = false;
          track.once('stateChanged', () => stateChanged = true);
          track.enable(true);
          assert(!stateChanged);
        });
      });

      context('"disabled"', () => {
        it('returns the TrackV2', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind()
          });
          assert.equal(track, track.enable(true));
        });

        it('sets .state to "enabled"', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind()
          });
          track.enable(true);
          assert.equal('enabled', track.state);
        });

        it('emits a "stateChanged" event with the new state "enabled"', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind()
          });
          var newState;
          track.once('stateChanged', _newState => newState = _newState);
          track.enable(true);
          assert.equal('enabled', newState);
        });
      });
    });

    context('called without an argument when the TrackV2\'s .state is', () => {
      context('"enabled"', () => {
        it('returns the TrackV2', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind()
          });
          assert.equal(track, track.enable());
        });

        it('.state remains "enabled"', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind()
          });
          track.enable();
          assert.equal('enabled', track.state);
        });

        it('"stateChanged" does not emit', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: true,
            kind: makeKind()
          });
          var stateChanged = false;
          track.once('stateChanged', () => stateChanged = true);
          track.enable();
          assert(!stateChanged);
        });
      });

      context('"ended"', () => {
        it('.state remains "ended"', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: makeEnabled(),
            kind: makeKind()
          });
          track.end();
          assert.equal(track, track.enable());
        });

        it('.state remains "ended"', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: makeEnabled(),
            kind: makeKind()
          });
          track.end();
          track.enable();
          assert.equal('ended', track.state);
        });

        it('"stateChanged" does not emit', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: makeEnabled(),
            kind: makeKind()
          });
          track.end();
          var stateChanged = false;
          track.once('stateChanged', () => stateChanged = true);
          track.enable();
          assert(!stateChanged);
        });
      });

      context('"disabled"', () => {
        it('returns the TrackV2', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind()
          });
          assert.equal(track, track.enable());
        });

        it('sets .state to "enabled"', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind()
          });
          track.enable();
          assert.equal('enabled', track.state);
        });

        it('emits a "stateChanged" event with the new state "enabled"', () => {
          var track = new TrackV2({
            id: makeId(),
            enabled: false,
            kind: makeKind()
          });
          var newState;
          track.once('stateChanged', _newState => newState = _newState);
          track.enable();
          assert.equal('enabled', newState);
        });
      });
    });
  });

  describe('#end', () => {
    context('called when the TrackV2\'s .state is "enabled"', () => {
      it('returns the TrackV2', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: true,
          kind: makeKind()
        });
        assert.equal(track, track.end());
      });

      it('sets .state to "ended"', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: true,
          kind: makeKind()
        });
        track.end();
        assert.equal('ended', track.state);
      });

      it('emits a "stateChanged" event with the new state "ended"', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: true,
          kind: makeKind()
        });
        var newState;
        track.once('stateChanged', _newState => newState = _newState);
        track.end();
        assert.equal('ended', newState);
      });
    });

    context('called when the TrackV2\'s .state is "ended"', () => {
      it('returns the TrackV2', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: makeEnabled(),
          kind: makeKind()
        });
        track.end();
        assert.equal(track, track.end());
      });

      it('.state remains "ended"', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: makeEnabled(),
          kind: makeKind()
        });
        track.end();
        track.end();
        assert.equal('ended', track.state);
      });

      it('"stateChanged" does not emit', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: makeEnabled(),
          kind: makeKind()
        });
        track.end();
        var stateChanged = false;
        track.once('stateChanged', () => stateChanged = true);
        track.end();
        assert(!stateChanged);
      });
    });

    context('called when the TrackV2\'s .state is "disabled"', () => {
      it('returns the TrackV2', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: false,
          kind: makeKind()
        });
        assert.equal(track, track.end());
      });

      it('sets .state to "ended"', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: false,
          kind: makeKind()
        });
        track.end();
        assert.equal('ended', track.state);
      });

      it('emits a "stateChanged" event with the new state "ended"', () => {
        var track = new TrackV2({
          id: makeId(),
          enabled: false,
          kind: makeKind()
        });
        var newState;
        track.once('stateChanged', _newState => newState = _newState);
        track.end();
        assert.equal('ended', newState);
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
