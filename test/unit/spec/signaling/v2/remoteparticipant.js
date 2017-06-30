'use strict';

var assert = require('assert');
var RemoteParticipantV2 = require('../../../../../lib/signaling/v2/remoteparticipant');
var sinon = require('sinon');
var util = require('../../../../../lib/util');

describe('RemoteParticipantV2', () => {
  // RemoteParticipantV2
  // -------------------

  describe('constructor', () => {
    it('sets .identity', () => {
      var test = makeTest();
      assert.equal(test.identity, test.participant.identity);
    });

    it('sets .revision', () => {
      var test = makeTest();
      assert.equal(test.revision, test.participant.revision);
    });

    it('sets .sid', () => {
      var test = makeTest();
      assert.equal(test.sid, test.participant.sid);
    });

    it('sets .state to "connected"', () => {
      var test = makeTest();
      assert.equal('connected', test.participant.state);
    });

    context('.tracks', () => {
      it('constructs a new RemoteTrackV2 from each trackState', () => {
        var id1 = makeId();
        var id2 = makeId();
        var test = makeTest({
          tracks: [
            { id: id1 },
            { id: id2 }
          ]
        });
        assert.equal(id1, test.remoteTrackV2s[0].id);
        assert.equal(id2, test.remoteTrackV2s[1].id);
      });

      it('adds the newly-constructed RemoteTrackV2s to the RemoteParticipantV2\'s .tracks Map', () => {
        var id1 = makeId();
        var id2 = makeId();
        var test = makeTest({
          tracks: [
            { id: id1 },
            { id: id2 }
          ]
        });
        assert.equal(
          test.remoteTrackV2s[0],
          test.participant.tracks.get(id1));
        assert.equal(
          test.remoteTrackV2s[1],
          test.participant.tracks.get(id2));
      });

      it('calls getMediaStreamTrack with the newly-constructed RemoteTrackV2s\' IDs', () => {
        var id1 = makeId();
        var id2 = makeId();
        var test = makeTest({
          tracks: [
            { id: id1 },
            { id: id2 }
          ]
        });
        assert.equal(id1, test.getMediaStreamTrack.args[0][0]);
        assert.equal(id2, test.getMediaStreamTrack.args[1][0]);
      });

      it('calls setMediaStreamTrack on the newly-constructed RemoteTrackV2s with the results of calling getMediaStreamTrack', () => {
        var id1 = makeId();
        var id2 = makeId();
        var test = makeTest({
          tracks: [
            { id: id1 },
            { id: id2 }
          ]
        });
        // NOTE(mroberts): Really we should provide mediaStreamTrack1 and
        // mediaStreamTrack2, etc., but it is a pain to setup.
        var mediaStreamTrack = {};
        test.getMediaStreamTrackDeferred.resolve(mediaStreamTrack);
        return test.getMediaStreamTrackDeferred.promise.then(() => {
          assert.equal(
            mediaStreamTrack,
            test.remoteTrackV2s[0].setMediaStreamTrack.args[0][0]);
          assert.equal(
            mediaStreamTrack,
            test.remoteTrackV2s[1].setMediaStreamTrack.args[0][0]);
        });
      });
    });
  });

  describe('#update, when called with a participantState at', () => {
    context('a newer revision', () => {
      it('returns the RemoteParticipantV2', () => {
        var test = makeTest();
        var participantState = test.state(test.revision + 1);
        assert.equal(
          test.participant,
          test.participant.update(participantState));
      });

      it('updates the .revision', () => {
        var test = makeTest();
        var participantState = test.state(test.revision + 1);
        test.participant.update(participantState);
        assert.equal(
          test.revision + 1,
          test.participant.revision);
      });

      context('which includes a new trackState not matching an existing RemoteTrackV2', () => {
        it('constructs a new RemoteTrackV2 from the trackState', () => {
          var test = makeTest();
          var id = makeId();
          var participantState = test.state(test.revision + 1).setTrack({ id: id });
          test.participant.update(participantState);
          assert.equal(id, test.remoteTrackV2s[0].id);
        });

        it('adds the newly-constructed RemoteTrackV2 to the RemoteParticipantV2\'s .tracks Map', () => {
          var test = makeTest();
          var id = makeId();
          var participantState = test.state(test.revision + 1).setTrack({ id: id });
          test.participant.update(participantState);
          assert.equal(
            test.remoteTrackV2s[0],
            test.participant.tracks.get(id));
        });

        it('emits the "trackAdded" event with the newly-constructed RemoteTrackV2', () => {
          var test = makeTest();
          var participantState = test.state(test.revision + 1).setTrack({ id: makeId() });
          var track;
          test.participant.once('trackAdded', _track => track = _track);
          test.participant.update(participantState);
          assert.equal(
            test.remoteTrackV2s[0],
            track);
        });

        it('calls getMediaStreamTrack with the newly-constructed RemoteTrackV2\'s ID', () => {
          var test = makeTest();
          var id = makeId();
          var participantState = test.state(test.revision + 1).setTrack({ id: id });
          test.participant.update(participantState);
          assert.equal(id, test.getMediaStreamTrack.args[0][0]);
        });

        it('calls setMediaStreamTrack on the newly-constructed RemoteTrackV2 with the result of calling getMediaStreamTrack', () => {
          var test = makeTest();
          var participantState = test.state(test.revision + 1).setTrack({ id: makeId() });
          test.participant.update(participantState);
          var mediaStreamTrack = {};
          test.getMediaStreamTrackDeferred.resolve(mediaStreamTrack);
          return test.getMediaStreamTrackDeferred.promise.then(() => {
            assert.equal(
              mediaStreamTrack,
              test.remoteTrackV2s[0].setMediaStreamTrack.args[0][0]);
          });
        });

        it('calls update with the trackState on the newly-constructed RemoteTrackV2', () => {
          var test = makeTest();
          var id = makeId();
          var participantState = test.state(test.revision + 1).setTrack({ id: id, fizz: 'buzz' });
          test.participant.update(participantState);
          assert.deepEqual(
            { id: id, fizz: 'buzz' },
            test.remoteTrackV2s[0].update.args[0][0]);
        });
      });

      context('which includes a trackState matching an existing RemoteTrackV2', () => {
        it('calls update with the trackState on the existing RemoteTrackV2', () => {
          var id = makeId();
          var test = makeTest({ tracks: [ { id: id } ] });
          var participantState = test.state(test.revision + 1).setTrack({ id: id, fizz: 'buzz' });
          test.participant.update(participantState);
          assert.deepEqual(
            { id: id, fizz: 'buzz' },
            test.remoteTrackV2s[0].update.args[1][0]);
        });
      });

      context('which no longer includes a trackState matching an existing RemoteTrackV2', () => {
        it('deletes the RemoteTrackV2 from the RemoteParticipantV2\'s .tracks Map', () => {
          var id = makeId();
          var test = makeTest({ tracks: [ { id: id } ] });
          var participantState = test.state(test.revision + 1);
          test.participant.update(participantState);
          assert(!test.participant.tracks.has(id));
        });

        it('emits the "trackRemoved" event with the RemoteTrackV2', () => {
          var id = makeId();
          var test = makeTest({ tracks: [ { id: id } ] });
          var participantState = test.state(test.revision + 1);
          var track;
          test.participant.once('trackRemoved', _track => track = _track);
          test.participant.update(participantState);
          assert.equal(
            test.remoteTrackV2s[0],
            track);
        });
      });

      context('with .state set to "connected" when the RemoteParticipantV2\'s .state is', () => {
        context('"connected"', () => {
          it('the .state remains "connected"', () => {
            var test = makeTest();
            var participantState = test.state(test.revision + 1).setState('connected');
            test.participant.update(participantState);
            assert.equal(
              'connected',
              test.participant.state);
          });

          it('does not emit the "stateChanged" event', () => {
            var test = makeTest();
            var participantState = test.state(test.revision + 1).setState('connected');
            var stateChanged = false;
            test.participant.once('stateChanged', () => stateChanged = true);
            test.participant.update(participantState);
            assert(!stateChanged);
          });
        });

        context('"disconnected"', () => {
          it('the .state remains "disconnected"', () => {
            var test = makeTest();
            var participantState = test.state(test.revision + 1).setState('connected');
            test.participant.disconnect();
            test.participant.update(participantState);
            assert.equal(
              'disconnected',
              test.participant.state);
          });

          it('does not emit the "stateChanged" event', () => {
            var test = makeTest();
            var participantState = test.state(test.revision + 1).setState('connected');
            test.participant.disconnect();
            var stateChanged = false;
            test.participant.once('stateChanged', () => stateChanged = true);
            test.participant.update(participantState);
            assert(!stateChanged);
          });
        });
      });

      context('with .state set to "disconnected" when the RemoteParticipantV2\'s .state is', () => {
        context('"connected"', () => {
          it('sets the .state to "disconnected"', () => {
            var test = makeTest();
            var participantState = test.state(test.revision + 1).setState('disconnected');
            test.participant.update(participantState);
            assert.equal(
              'disconnected',
              test.participant.state);
          });

          it('emits the "stateChanged" event with the new state "disconnected"', () => {
            var test = makeTest();
            var participantState = test.state(test.revision + 1).setState('disconnected');
            var newState;
            test.participant.once('stateChanged', state => newState = state);
            test.participant.update(participantState);
            assert.equal(
              'disconnected',
              newState);
          });
        });

        context('"disconnected"', () => {
          it('the .state remains "disconnected"', () => {
            var test = makeTest();
            var participantState = test.state(test.revision + 1).setState('disconnected');
            test.participant.disconnect();
            test.participant.update(participantState);
            assert.equal(
              'disconnected',
              test.participant.state);
          });

          it('does not emit the "stateChanged" event', () => {
            var test = makeTest();
            var participantState = test.state(test.revision + 1).setState('disconnected');
            test.participant.disconnect();
            var stateChanged = false;
            test.participant.once('stateChanged', () => stateChanged = true);
            test.participant.update(participantState);
            assert(!stateChanged);
          });
        });
      });

      context('which changes the .identity', () => {
        it('the .identity remains unchanged', () => {
          var test = makeTest();
          var participantState = test.state(test.revision + 1).setIdentity(makeIdentity());
          test.participant.update(participantState);
          assert.equal(
            test.identity,
            test.participant.identity);
        });
      });

      context('which changes the .sid', () => {
        it('the .identity remains unchanged', () => {
          var test = makeTest();
          var participantState = test.state(test.revision + 1).setSid(makeSid());
          test.participant.update(participantState);
          assert.equal(
            test.sid,
            test.participant.sid);
        });
      });
    });

    context('the same revision', () => {
      it('returns the RemoteParticipantV2', () => {
        var test = makeTest();
        var participantState = test.state(test.revision);
        assert.equal(
          test.participant,
          test.participant.update(participantState));
      });

      it('does not update the .revision', () => {
        var test = makeTest();
        var participantState = test.state(test.revision);
        test.participant.update(participantState);
        assert.equal(
          test.revision,
          test.participant.revision);
      });

      context('which includes a new trackState not matching an existing RemoteTrackV2', () => {
        it('does not construct a new RemoteTrackV2 from the trackState', () => {
          var test = makeTest();
          var participantState = test.state(test.revision).setTrack({ id: makeId() });
          test.participant.update(participantState);
          assert.equal(0, test.remoteTrackV2s.length);
        });

        it('does not call getMediaStreamTrack with a newly-constructed RemoteTrackV2\'s ID', () => {
          var test = makeTest();
          var participantState = test.state(test.revision).setTrack({ id: makeId() });
          test.participant.update(participantState);
          assert(!test.getMediaStreamTrack.calledOnce);
        });
      });

      context('which includes a trackState matching an existing RemoteTrackV2', () => {
        it('does not call update with the trackState on the existing RemoteTrackV2', () => {
          var id = makeId();
          var test = makeTest({ tracks: [ { id: id } ] });
          var participantState = test.state(test.revision).setTrack({ id: id });
          test.participant.update(participantState);
          assert(!test.remoteTrackV2s[0].update.calledTwice);
        });
      });

      context('which no longer includes a trackState matching an existing RemoteTrackV2', () => {
        it('does not delete the RemoteTrackV2 from the RemoteParticipantV2\'s .tracks Map', () => {
          var id = makeId();
          var test = makeTest({ tracks: [ { id: id } ] });
          var participantState = test.state(test.revision);
          test.participant.update(participantState);
          assert.equal(
            test.remoteTrackV2s[0],
            test.participant.tracks.get(id));
        });

        it('does not emit the "trackRemoved" event with the RemoteTrackV2', () => {
          var id = makeId();
          var test = makeTest({ tracks: [ { id: id } ] });
          var participantState = test.state(test.revision);
          var trackRemoved = false;
          test.participant.once('trackRemoved', () => trackRemoved = false);
          test.participant.update(participantState);
          assert(!trackRemoved);
        });
      });

      context('with .state set to "connected" when the RemoteParticipantV2\'s .state is', () => {
        context('"connected"', () => {
          it('the .state remains "connected"', () => {
            var test = makeTest();
            var participantState = test.state(test.revision).setState('connected');
            test.participant.update(participantState);
            assert.equal(
              'connected',
              test.participant.state);
          });

          it('does not emit the "stateChanged" event', () => {
            var test = makeTest();
            var participantState = test.state(test.revision).setState('connected');
            var stateChanged = false;
            test.participant.once('stateChanged', () => stateChanged = true);
            test.participant.update(participantState);
            assert(!stateChanged);
          });
        });

        context('"disconnected"', () => {
          it('the .state remains "disconnected"', () => {
            var test = makeTest();
            var participantState = test.state(test.revision).setState('connected');
            test.participant.disconnect();
            test.participant.update(participantState);
            assert.equal(
              'disconnected',
              test.participant.state);
          });

          it('does not emit the "stateChanged" event', () => {
            var test = makeTest();
            var participantState = test.state(test.revision).setState('connected');
            test.participant.disconnect();
            var stateChanged = false;
            test.participant.once('stateChanged', () => stateChanged = true);
            test.participant.update(participantState);
            assert(!stateChanged);
          });
        });
      });

      context('with .state set to "disconnected" when the RemoteParticipantV2\'s .state is', () => {
        context('"connected"', () => {
          it('the .state remains "connected"', () => {
            var test = makeTest();
            var participantState = test.state(test.revision).setState('disconnected');
            test.participant.update(participantState);
            assert.equal(
              'connected',
              test.participant.state);
          });

          it('does not emit the "stateChanged" event', () => {
            var test = makeTest();
            var participantState = test.state(test.revision).setState('disconnected');
            var stateChanged = false;
            test.participant.once('stateChanged', () => stateChanged = true);
            test.participant.update(participantState);
            assert(!stateChanged);
          });
        });

        context('"disconnected"', () => {
          it('the .state remains "disconnected"', () => {
            var test = makeTest();
            var participantState = test.state(test.revision).setState('disconnected');
            test.participant.disconnect();
            test.participant.update(participantState);
            assert.equal(
              'disconnected',
              test.participant.state);
          });

          it('does not emit the "stateChanged" event', () => {
            var test = makeTest();
            var participantState = test.state(test.revision).setState('disconnected');
            test.participant.disconnect();
            var stateChanged = false;
            test.participant.once('stateChanged', () => stateChanged = true);
            test.participant.update(participantState);
            assert(!stateChanged);
          });
        });
      });

      context('which changes the .identity', () => {
        it('the .identity remains unchanged', () => {
          var test = makeTest();
          var participantState = test.state(test.revision).setIdentity(makeIdentity());
          test.participant.update(participantState);
          assert.equal(
            test.identity,
            test.participant.identity);
        });
      });

      context('which changes the .sid', () => {
        it('the .identity remains unchanged', () => {
          var test = makeTest();
          var participantState = test.state(test.revision).setSid(makeSid());
          test.participant.update(participantState);
          assert.equal(
            test.sid,
            test.participant.sid);
        });
      });
    });

    context('an older revision', () => {
      it('returns the RemoteParticipantV2', () => {
        var test = makeTest();
        var participantState = test.state(test.revision - 1);
        test.participant.update(participantState);
        assert.equal(
          test.revision,
          test.participant.revision);
      });

      it('does not update the .revision', () => {
        var test = makeTest();
        var participantState = test.state(test.revision - 1);
        test.participant.update(participantState);
        assert.equal(
          test.revision,
          test.participant.revision);
      });

      context('which includes a new trackState not matching an existing RemoteTrackV2', () => {
        it('does not construct a new RemoteTrackV2 from the trackState', () => {
          var test = makeTest();
          var participantState = test.state(test.revision - 1).setTrack({ id: makeId() });
          test.participant.update(participantState);
          assert.equal(0, test.remoteTrackV2s.length);
        });

        it('does not call getMediaStreamTrack with a newly-constructed RemoteTrackV2\'s ID', () => {
          var test = makeTest();
          var participantState = test.state(test.revision - 1).setTrack({ id: makeId() });
          test.participant.update(participantState);
          assert(!test.getMediaStreamTrack.calledOnce);
        });
      });

      context('which includes a trackState matching an existing RemoteTrackV2', () => {
        it('does not call update with the trackState on the existing RemoteTrackV2', () => {
          var id = makeId();
          var test = makeTest({ tracks: [ { id: id } ] });
          var participantState = test.state(test.revision - 1).setTrack({ id: id });
          test.participant.update(participantState);
          assert(!test.remoteTrackV2s[0].update.calledTwice);
        });
      });

      context('which no longer includes a trackState matching an existing RemoteTrackV2', () => {
        it('does not delete the RemoteTrackV2 from the RemoteParticipantV2\'s .tracks Map', () => {
          var id = makeId();
          var test = makeTest({ tracks: [ { id: id } ] });
          var participantState = test.state(test.revision - 1);
          test.participant.update(participantState);
          assert.equal(
            test.remoteTrackV2s[0],
            test.participant.tracks.get(id));
        });

        it('does not emit the "trackRemoved" event with the RemoteTrackV2', () => {
          var id = makeId();
          var test = makeTest({ tracks: [ { id: id } ] });
          var participantState = test.state(test.revision - 1);
          var trackRemoved = false;
          test.participant.once('trackRemoved', () => trackRemoved = false);
          test.participant.update(participantState);
          assert(!trackRemoved);
        });
      });

      context('with .state set to "connected" when the RemoteParticipantV2\'s .state is', () => {
        context('"connected"', () => {
          it('the .state remains "connected"', () => {
            var test = makeTest();
            var participantState = test.state(test.revision - 1).setState('connected');
            test.participant.update(participantState);
            assert.equal(
              'connected',
              test.participant.state);
          });

          it('does not emit the "stateChanged" event', () => {
            var test = makeTest();
            var participantState = test.state(test.revision - 1).setState('connected');
            var stateChanged = false;
            test.participant.once('stateChanged', () => stateChanged = true);
            test.participant.update(participantState);
            assert(!stateChanged);
          });
        });

        context('"disconnected"', () => {
          it('the .state remains "disconnected"', () => {
            var test = makeTest();
            var participantState = test.state(test.revision - 1).setState('connected');
            test.participant.disconnect();
            test.participant.update(participantState);
            assert.equal(
              'disconnected',
              test.participant.state);
          });

          it('does not emit the "stateChanged" event', () => {
            var test = makeTest();
            var participantState = test.state(test.revision - 1).setState('connected');
            test.participant.disconnect();
            var stateChanged = false;
            test.participant.once('stateChanged', () => stateChanged = true);
            test.participant.update(participantState);
            assert(!stateChanged);
          });
        });
      });

      context('with .state set to "disconnected" when the RemoteParticipantV2\'s .state is', () => {
        context('"connected"', () => {
          it('the .state remains "connected"', () => {
            var test = makeTest();
            var participantState = test.state(test.revision - 1).setState('disconnected');
            test.participant.update(participantState);
            assert.equal(
              'connected',
              test.participant.state);
          });

          it('does not emit the "stateChanged" event', () => {
            var test = makeTest();
            var participantState = test.state(test.revision - 1).setState('disconnected');
            var stateChanged = false;
            test.participant.once('stateChanged', () => stateChanged = true);
            test.participant.update(participantState);
            assert(!stateChanged);
          });
        });

        context('"disconnected"', () => {
          it('the .state remains "disconnected"', () => {
            var test = makeTest();
            var participantState = test.state(test.revision - 1).setState('disconnected');
            test.participant.disconnect();
            test.participant.update(participantState);
            assert.equal(
              'disconnected',
              test.participant.state);
          });

          it('does not emit the "stateChanged" event', () => {
            var test = makeTest();
            var participantState = test.state(test.revision - 1).setState('disconnected');
            test.participant.disconnect();
            var stateChanged = false;
            test.participant.once('stateChanged', () => stateChanged = true);
            test.participant.update(participantState);
            assert(!stateChanged);
          });
        });
      });

      context('which changes the .identity', () => {
        it('the .identity remains unchanged', () => {
          var test = makeTest();
          var participantState = test.state(test.revision - 1).setIdentity(makeIdentity());
          test.participant.update(participantState);
          assert.equal(
            test.identity,
            test.participant.identity);
        });
      });

      context('which changes the .sid', () => {
        it('the .identity remains unchanged', () => {
          var test = makeTest();
          var participantState = test.state(test.revision - 1).setSid(makeSid());
          test.participant.update(participantState);
          assert.equal(
            test.sid,
            test.participant.sid);
        });
      });
    });
  });

  // ParticipantSignaling
  // --------------------

  describe('#addTrack', () => {
    it('returns the RemoteParticipantV2', () => {
      var RemoteTrackV2 = makeRemoteTrackV2Constructor();
      var test = makeTest();
      var track = new RemoteTrackV2({ id: makeId() });
      assert.equal(
        test.participant,
        test.participant.addTrack(track));
    });

    it('adds the RemoteTrackV2 to the RemoteParticipantV2\'s .tracks Map', () => {
      var RemoteTrackV2 = makeRemoteTrackV2Constructor();
      var test = makeTest();
      var id = makeId();
      var track = new RemoteTrackV2({ id: id });
      test.participant.addTrack(track);
      assert.equal(
        track,
        test.participant.tracks.get(id));
    });

    it('emits the "trackAdded" event with the RemoteTrackV2', () => {
      var RemoteTrackV2 = makeRemoteTrackV2Constructor();
      var test = makeTest();
      var track = new RemoteTrackV2({ id: makeId() });
      var trackAdded;
      test.participant.once('trackAdded', track => trackAdded = track);
      test.participant.addTrack(track);
      assert.equal(
        track,
        trackAdded);
    });

    it('calls getMediaStreamTrack with the newly-constructed RemoteTrackV2\'s ID', () => {
      var RemoteTrackV2 = makeRemoteTrackV2Constructor();
      var test = makeTest();
      var id = makeId();
      var track = new RemoteTrackV2({ id: id });
      test.participant.addTrack(track);
      assert.equal(id, test.getMediaStreamTrack.args[0][0]);
    });

    it('calls setMediaStreamTrack on the newly-constructed RemoteTrackV2 with the result of calling getMediaStreamTrack', () => {
      var RemoteTrackV2 = makeRemoteTrackV2Constructor();
      var test = makeTest();
      var id = makeId();
      var track = new RemoteTrackV2({ id: id });
      test.participant.addTrack(track);
      var mediaStreamTrack = {};
      test.getMediaStreamTrackDeferred.resolve(mediaStreamTrack);
      return test.getMediaStreamTrackDeferred.promise.then(() => {
        assert.equal(
          mediaStreamTrack,
          track.setMediaStreamTrack.args[0][0]);
      });
    });
  });

  describe('#connect', () => {
    context('when the RemoteParticipantV2\'s .state is "connected"', () => {
      it('returns false', () => {
        var test = makeTest();
        assert.equal(
          false,
          test.participant.connect(makeSid(), makeIdentity()));
      });

      it('the .identity remains the same', () => {
        var test = makeTest();
        test.participant.connect(makeSid(), makeIdentity());
        assert.equal(
          test.identity,
          test.participant.identity);
      });

      it('the .sid remains the same', () => {
        var test = makeTest();
        test.participant.connect(makeSid(), makeIdentity());
        assert.equal(
          test.sid,
          test.participant.sid);
      });

      it('the .state remains "connected"', () => {
        var test = makeTest();
        test.participant.connect(makeSid(), makeIdentity());
        assert.equal(
          'connected',
          test.participant.state);
      });

      it('does not emit the "stateChanged" event', () => {
        var test = makeTest();
        var stateChanged;
        test.participant.once('stateChanged', () => stateChanged = true);
        test.participant.connect(makeSid(), makeIdentity());
        assert(!stateChanged);
      });
    });

    context('when the RemoteParticipantV2\'s .state is "disconnected"', () => {
      it('returns false', () => {
        var test = makeTest();
        test.participant.disconnect();
        assert.equal(
          false,
          test.participant.connect(makeSid(), makeIdentity()));
      });

      it('the .identity remains the same', () => {
        var test = makeTest();
        test.participant.disconnect();
        test.participant.connect(makeSid(), makeIdentity());
        assert.equal(
          test.identity,
          test.participant.identity);
      });

      it('the .sid remains the same', () => {
        var test = makeTest();
        test.participant.disconnect();
        test.participant.connect(makeSid(), makeIdentity());
        assert.equal(
          test.sid,
          test.participant.sid);
      });

      it('the .state remains "disconnected"', () => {
        var test = makeTest();
        test.participant.disconnect();
        test.participant.connect(makeSid(), makeIdentity());
        assert.equal(
          'disconnected',
          test.participant.state);
      });

      it('does not emit the "stateChanged" event', () => {
        var test = makeTest();
        test.participant.disconnect();
        var stateChanged;
        test.participant.once('stateChanged', () => stateChanged = true);
        test.participant.connect(makeSid(), makeIdentity());
        assert(!stateChanged);
      });
    });
  });

  describe('#disconnect', () => {
    context('when the RemoteParticipantV2\'s .state is "connected"', () => {
      it('returns true', () => {
        var test = makeTest();
        assert.equal(
          true,
          test.participant.disconnect());
      });

      it('sets the .state to "disconnected"', () => {
        var test = makeTest();
        test.participant.disconnect();
        assert.equal(
          'disconnected',
          test.participant.state);
      });

      it('emits the "stateChanged" event with the new state "disconnected"', () => {
        var test = makeTest();
        var newState;
        test.participant.once('stateChanged', state => newState = state);
        test.participant.disconnect();
        assert.equal(
          'disconnected',
          newState);
      });
    });

    context('when the RemoteParticipantV2\'s .state is "disconnected"', () => {
      it('returns false', () => {
        var test = makeTest();
        test.participant.disconnect();
        assert.equal(
          false,
          test.participant.disconnect());
      });

      it('the .state remains "disconnected"', () => {
        var test = makeTest();
        test.participant.disconnect();
        test.participant.disconnect();
        assert.equal(
          'disconnected',
          test.participant.state);
      });

      it('does not emit the "stateChanged" event', () => {
        var test = makeTest();
        test.participant.disconnect();
        var stateChanged = false;
        test.participant.once('stateChanged', () => stateChanged = true);
        test.participant.disconnect();
        assert(!stateChanged);
      });
    });
  });

  describe('#removeTrack', () => {
    context('when the RemoteTrackV2 to remove was previously added', () => {
      it('returns true', () => {
        var test = makeTest({ tracks: [ { id: makeId() } ] });
        assert.equal(
          true,
          test.participant.removeTrack(test.remoteTrackV2s[0]));
      });

      it('deletes the RemoteTrackV2 from the RemoteParticipantV2\'s .tracks Map', () => {
        var test = makeTest({ tracks: [ { id: makeId() } ] });
        test.participant.removeTrack(test.remoteTrackV2s[0]);
        assert(!test.participant.tracks.has(test.remoteTrackV2s[0].id));
      });

      it('emits the "trackRemoved" event with the RemoteTrackV2', () => {
        var test = makeTest({ tracks: [ { id: makeId() } ] });
        var trackRemoved;
        test.participant.once('trackRemoved', track => trackRemoved = track);
        test.participant.removeTrack(test.remoteTrackV2s[0]);
        assert.equal(
          test.remoteTrackV2s[0],
          trackRemoved);
      });
    });

    context('when the RemoteTrackV2 to remove was not previously added', () => {
      it('returns false', () => {
        var RemoteTrackV2 = makeRemoteTrackV2Constructor();
        var track = new RemoteTrackV2({ id: makeId() });
        var test = makeTest();
        assert.equal(
          false,
          test.participant.removeTrack(track));
      });

      it('does not emit the "trackRemoved" event with the RemoteTrackV2', () => {
        var RemoteTrackV2 = makeRemoteTrackV2Constructor();
        var track = new RemoteTrackV2({ id: makeId() });
        var test = makeTest();
        var trackRemoved = false;
        test.participant.once('trackRemoved', () => trackRemoved = true);
        test.participant.removeTrack(track);
        assert(!trackRemoved);
      });
    });
  });
});

function makeId() {
  return Math.floor(Math.random() * 1000 + 0.5);
}

function makeIdentity(length) {
  return Math.random().toString(36).slice(2);
}

function makeSid() {
  var sid = 'PA';
  for (var i = 0; i < 32; i++) {
    sid += 'abcdef0123456789'.split('')[Math.floor(Math.random() * 16)];
  }
  return sid;
}

function makeRevision() {
  return Math.floor(Math.random() * 101);
}

function makeTest(options) {
  options = options || {};

  options.identity = options.identity || makeIdentity();
  options.revision = options.revision || makeRevision();
  options.sid = options.sid || makeSid();
  options.tracks = options.tracks || [];
  options.remoteTrackV2s = options.remoteTrackV2s || [];

  options.getMediaStreamTrackDeferred = options.getMediaStreamTrackDeferred
    || util.defer();
  options.getMediaStreamTrack = options.getMediaStreamTrack
    || sinon.spy(() => options.getMediaStreamTrackDeferred.promise);
  options.RemoteTrackV2 = options.RemoteTrackV2 || makeRemoteTrackV2Constructor(options);

  options.participant = options.participant || makeRemoteParticipantV2(options);

  options.state = (revision) => {
    return new RemoteParticipantStateBuilder(options.participant, revision);
  };

  return options;
}

function RemoteParticipantStateBuilder(participant, revision) {
  this.identity = participant.identity;
  this.revision = revision;
  this.state = participant.state;
  this.sid = participant.sid;
  this.tracks = [];
}

RemoteParticipantStateBuilder.prototype.setIdentity = function setIdentity(identity) {
  this.identity = identity;
  return this;
};

RemoteParticipantStateBuilder.prototype.setSid = function setSid(sid) {
  this.sid = sid;
  return this;
};

RemoteParticipantStateBuilder.prototype.setState = function setState(state) {
  this.state = state;
  return this;
};

RemoteParticipantStateBuilder.prototype.setTrack = function setTrack(track) {
  this.tracks.push(track);
  return this;
};

RemoteParticipantStateBuilder.prototype.setTracks = function setTracks(tracks) {
  tracks.forEach(this.setTrack, this);
  return this;
};

function makeRemoteParticipantV2(options) {
  return new RemoteParticipantV2(options, options.getMediaStreamTrack, options);
}

function makeRemoteTrackV2Constructor(testOptions) {
  testOptions = testOptions || {};
  testOptions.remoteTrackV2s = testOptions.remoteTrackV2s || [];
  return function RemoteTrackV2(trackState) {
    this.id = trackState.id;
    this.setMediaStreamTrack = sinon.spy(() => {});
    this.update = sinon.spy(() => this);
    testOptions.remoteTrackV2s.push(this);
  };
}
