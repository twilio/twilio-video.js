'use strict';

const assert = require('assert');
const sinon = require('sinon');

const RemoteParticipantV2 = require('../../../../../lib/signaling/v2/remoteparticipant');
const { defer } = require('../../../../../lib/util');
const { combinationContext } = require('../../../../lib/util');

describe('RemoteParticipantV2', () => {
  // RemoteParticipantV2
  // -------------------

  describe('constructor', () => {
    it('sets .identity', () => {
      const test = makeTest();
      assert.equal(test.identity, test.participant.identity);
    });

    it('sets .revision', () => {
      const test = makeTest();
      assert.equal(test.revision, test.participant.revision);
    });

    it('sets .sid', () => {
      const test = makeTest();
      assert.equal(test.sid, test.participant.sid);
    });

    ['connected', 'reconnecting'].forEach(state => {
      context(`when initial .state is "${state}"`, () => {
        it(`sets .state to "${state}"`, () => {
          const test = makeTest({ state });
          assert.equal(state, test.participant.state);
        });
      });
    });

    context('.tracks', () => {
      it('constructs a new RemoteTrackPublicationV2 from each trackState', () => {
        const sid1 = makeSid();
        const sid2 = makeSid();
        const test = makeTest({
          tracks: [
            { sid: sid1 },
            { sid: sid2 }
          ]
        });
        assert.equal(sid1, test.remoteTrackPublicationV2s[0].sid);
        assert.equal(sid2, test.remoteTrackPublicationV2s[1].sid);
      });

      it('adds the newly-constructed RemoteTrackPublicationV2s to the RemoteParticipantV2\'s .tracks Map', () => {
        const sid1 = makeSid();
        const sid2 = makeSid();
        const test = makeTest({
          tracks: [
            { sid: sid1 },
            { sid: sid2 }
          ]
        });
        assert.equal(
          test.remoteTrackPublicationV2s[0],
          test.participant.tracks.get(sid1));
        assert.equal(
          test.remoteTrackPublicationV2s[1],
          test.participant.tracks.get(sid2));
      });
    });
  });

  describe('#update, when called with a participantState at', () => {
    context('a newer revision', () => {
      it('returns the RemoteParticipantV2', () => {
        const test = makeTest();
        const participantState = test.state(test.revision + 1);
        assert.equal(
          test.participant,
          test.participant.update(participantState));
      });

      it('updates the .revision', () => {
        const test = makeTest();
        const participantState = test.state(test.revision + 1);
        test.participant.update(participantState);
        assert.equal(
          test.revision + 1,
          test.participant.revision);
      });

      context('which includes a new trackState not matching an existing RemoteTrackPublicationV2', () => {
        it('constructs a new RemoteTrackPublicationV2 from the trackState', () => {
          const test = makeTest();
          const sid = makeSid();
          const participantState = test.state(test.revision + 1).setTrack({ sid });
          test.participant.update(participantState);
          assert.equal(sid, test.remoteTrackPublicationV2s[0].sid);
        });

        it('adds the newly-constructed RemoteTrackPublicationV2 to the RemoteParticipantV2\'s .tracks Map', () => {
          const test = makeTest();
          const sid = makeSid();
          const participantState = test.state(test.revision + 1).setTrack({ sid });
          test.participant.update(participantState);
          assert.equal(
            test.remoteTrackPublicationV2s[0],
            test.participant.tracks.get(sid));
        });

        it('emits the "trackAdded" event with the newly-constructed RemoteTrackPublicationV2', () => {
          const test = makeTest();
          const participantState = test.state(test.revision + 1).setTrack({ id: makeSid() });
          let track;
          test.participant.once('trackAdded', _track => { track = _track; });
          test.participant.update(participantState);
          assert.equal(
            test.remoteTrackPublicationV2s[0],
            track);
        });

        it('calls update with the trackState on the newly-constructed RemoteTrackPublicationV2', () => {
          const test = makeTest();
          const sid = makeSid();
          const participantState = test.state(test.revision + 1).setTrack({ sid, fizz: 'buzz' });
          test.participant.update(participantState);
          assert.deepEqual(
            { sid, fizz: 'buzz' },
            test.remoteTrackPublicationV2s[0].update.args[0][0]);
        });
      });

      context('which includes a trackState matching an existing RemoteTrackPublicationV2', () => {
        it('calls update with the trackState on the existing RemoteTrackPublicationV2', () => {
          const sid = makeSid();
          const test = makeTest({ tracks: [{ sid }] });
          const participantState = test.state(test.revision + 1).setTrack({ sid, fizz: 'buzz' });
          test.participant.update(participantState);
          assert.deepEqual(
            { sid, fizz: 'buzz' },
            test.remoteTrackPublicationV2s[0].update.args[1][0]);
        });
      });

      context('which no longer includes a trackState matching an existing RemoteTrackPublicationV2', () => {
        it('deletes the RemoteTrackPublicationV2 from the RemoteParticipantV2\'s .tracks Map', () => {
          const sid = makeSid();
          const test = makeTest({ tracks: [{ sid }] });
          const participantState = test.state(test.revision + 1);
          test.participant.update(participantState);
          assert(!test.participant.tracks.has(sid));
        });

        it('emits the "trackRemoved" event with the RemoteTrackPublicationV2', () => {
          const sid = makeSid();
          const test = makeTest({ tracks: [{ sid }] });
          const participantState = test.state(test.revision + 1);
          let track;
          test.participant.once('trackRemoved', _track => { track = _track; });
          test.participant.update(participantState);
          assert.equal(
            test.remoteTrackPublicationV2s[0],
            track);
        });
      });

      context('with .state set to "connected" when the RemoteParticipantV2\'s .state is', () => {
        context('"reconnecting"', () => {
          it('should transition the .state to "connected"', () => {
            const test = makeTest({ state: 'reconnecting' });
            const participantState = test.state(test.revision + 1).setState('connected');
            test.participant.update(participantState);
            assert.equal(test.participant.state, 'connected');
          });

          it('should emit "stateChanged" on the RemoteParticipantV2', () => {
            const test = makeTest({ state: 'reconnecting' });
            const participantState = test.state(test.revision + 1).setState('connected');
            let stateChanged;
            test.participant.once('stateChanged', () => { stateChanged = true; });
            test.participant.update(participantState);
            assert(stateChanged);
          });
        });

        ['connected', 'disconnected'].forEach(state => {
          context(`"${state}"`, () => {
            it(`the .state should remain "${state}"`, () => {
              const test = makeTest({ state });
              const participantState = test.state(test.revision + 1).setState('connected');
              test.participant.update(participantState);
              assert.equal(test.participant.state, state);
            });

            it('should not emit "stateChanged" on the RemoteParticipantV2', () => {
              const test = makeTest({ state });
              const participantState = test.state(test.revision + 1).setState('connected');
              let stateChanged;
              test.participant.once('stateChanged', () => { stateChanged = true; });
              test.participant.update(participantState);
              assert(!stateChanged);
            });
          });
        });
      });

      context('with .state set to "disconnected" when the RemoteParticipantV2\'s .state is', () => {
        ['connected', 'reconnecting'].forEach(state => {
          context(`"${state}"`, () => {
            it('should transition the .state to "disconnected"', () => {
              const test = makeTest({ state });
              const participantState = test.state(test.revision + 1).setState('disconnected');
              test.participant.update(participantState);
              assert.equal(test.participant.state, 'disconnected');
            });

            it('should emit "stateChanged" event on the RemoteParticipantV2"', () => {
              const test = makeTest({ state });
              const participantState = test.state(test.revision + 1).setState('disconnected');
              let stateChanged;
              test.participant.once('stateChanged', () => { stateChanged = true; });
              test.participant.update(participantState);
              assert(stateChanged);
            });
          });
        });

        context('"disconnected"', () => {
          it('the .state remains "disconnected"', () => {
            const test = makeTest();
            const participantState = test.state(test.revision + 1).setState('disconnected');
            test.participant.disconnect();
            test.participant.update(participantState);
            assert.equal(
              'disconnected',
              test.participant.state);
          });

          it('does not emit the "stateChanged" event', () => {
            const test = makeTest();
            const participantState = test.state(test.revision + 1).setState('disconnected');
            test.participant.disconnect();
            let stateChanged;
            test.participant.once('stateChanged', () => { stateChanged = true; });
            test.participant.update(participantState);
            assert(!stateChanged);
          });
        });
      });

      context('with .state set to "reconnecting" when the RemoteParticipantV2\'s .state is', () => {
        ['disconnected', 'reconnecting'].forEach(state => {
          context(`"${state}"`, () => {
            it(`the .state should remain "${state}"`, () => {
              const test = makeTest({ state });
              const participantState = test.state(test.revision + 1).setState('reconnecting');
              test.participant.update(participantState);
              assert.equal(test.participant.state, state);
            });

            it('should not emit "stateChanged" event on the RemoteParticipantV2"', () => {
              const test = makeTest({ state });
              const participantState = test.state(test.revision + 1).setState('reconnecting');
              let stateChanged;
              test.participant.once('stateChanged', () => { stateChanged = true; });
              test.participant.update(participantState);
              assert(!stateChanged);
            });
          });
        });

        context('"connected"', () => {
          it('should transition the .state to "reconnecting"', () => {
            const test = makeTest();
            const participantState = test.state(test.revision + 1).setState('reconnecting');
            test.participant.update(participantState);
            assert.equal(test.participant.state, 'reconnecting');
          });

          it('should emit "stateChanged" on the RemoteParticipantV2', () => {
            const test = makeTest();
            const participantState = test.state(test.revision + 1).setState('reconnecting');
            let stateChanged;
            test.participant.once('stateChanged', () => { stateChanged = true; });
            test.participant.update(participantState);
            assert(stateChanged);
          });
        });
      });

      context('which changes the .identity', () => {
        it('the .identity remains unchanged', () => {
          const test = makeTest();
          const participantState = test.state(test.revision + 1).setIdentity(makeIdentity());
          test.participant.update(participantState);
          assert.equal(
            test.identity,
            test.participant.identity);
        });
      });

      context('which changes the .sid', () => {
        it('the .identity remains unchanged', () => {
          const test = makeTest();
          const participantState = test.state(test.revision + 1).setSid(makeSid());
          test.participant.update(participantState);
          assert.equal(
            test.sid,
            test.participant.sid);
        });
      });
    });

    context('the same revision', () => {
      it('returns the RemoteParticipantV2', () => {
        const test = makeTest();
        const participantState = test.state(test.revision);
        assert.equal(
          test.participant,
          test.participant.update(participantState));
      });

      it('does not update the .revision', () => {
        const test = makeTest();
        const participantState = test.state(test.revision);
        test.participant.update(participantState);
        assert.equal(
          test.revision,
          test.participant.revision);
      });

      context('which includes a new trackState not matching an existing RemoteTrackPublicationV2', () => {
        it('does not construct a new RemoteTrackPublicationV2 from the trackState', () => {
          const test = makeTest();
          const participantState = test.state(test.revision).setTrack({ sid: makeSid() });
          test.participant.update(participantState);
          assert.equal(0, test.remoteTrackPublicationV2s.length);
        });

        it('does not call getTrackTransceiver with a newly-constructed RemoteTrackPublicationV2\'s ID', () => {
          const test = makeTest();
          const participantState = test.state(test.revision).setTrack({ sid: makeSid() });
          test.participant.update(participantState);
          assert(!test.getTrackTransceiver.calledOnce);
        });
      });

      context('which includes a trackState matching an existing RemoteTrackPublicationV2', () => {
        it('does not call update with the trackState on the existing RemoteTrackPublicationV2', () => {
          const sid = makeSid();
          const test = makeTest({ tracks: [{ sid }] });
          const participantState = test.state(test.revision).setTrack({ sid });
          test.participant.update(participantState);
          assert(!test.remoteTrackPublicationV2s[0].update.calledTwice);
        });
      });

      context('which no longer includes a trackState matching an existing RemoteTrackPublicationV2', () => {
        it('does not delete the RemoteTrackPublicationV2 from the RemoteParticipantV2\'s .tracks Map', () => {
          const sid = makeSid();
          const test = makeTest({ tracks: [{ sid }] });
          const participantState = test.state(test.revision);
          test.participant.update(participantState);
          assert.equal(
            test.remoteTrackPublicationV2s[0],
            test.participant.tracks.get(sid));
        });

        it('does not emit the "trackRemoved" event with the RemoteTrackPublicationV2', () => {
          const sid = makeSid();
          const test = makeTest({ tracks: [{ sid }] });
          const participantState = test.state(test.revision);
          let trackRemoved;
          test.participant.once('trackRemoved', () => { trackRemoved = false; });
          test.participant.update(participantState);
          assert(!trackRemoved);
        });
      });

      combinationContext([
        [
          ['connected', 'reconnecting', 'disconnected'],
          x => `with .state set to "${x}" when the RemoteParticipantV2's .state is`
        ],
        [
          ['connected', 'reconnecting', 'disconnected'],
          x => `"${x}"`
        ]
      ], ([nextState, state]) => {
        it(`the .state should remain "${state}"`, () => {
          const test = makeTest({ state });
          const participantState = test.state(test.revision).setState(nextState);
          test.participant.update(participantState);
          assert.equal(test.participant.state, state);
        });

        it('should not emit "stateChanged" on the RemoteParticipantV2', () => {
          const test = makeTest({ state });
          const participantState = test.state(test.revision).setState(nextState);
          let stateChanged;
          test.participant.once('stateChanged', () => { stateChanged = true; });
          test.participant.update(participantState);
          assert(!stateChanged);
        });
      });

      context('which changes the .identity', () => {
        it('the .identity remains unchanged', () => {
          const test = makeTest();
          const participantState = test.state(test.revision).setIdentity(makeIdentity());
          test.participant.update(participantState);
          assert.equal(
            test.identity,
            test.participant.identity);
        });
      });

      context('which changes the .sid', () => {
        it('the .identity remains unchanged', () => {
          const test = makeTest();
          const participantState = test.state(test.revision).setSid(makeSid());
          test.participant.update(participantState);
          assert.equal(
            test.sid,
            test.participant.sid);
        });
      });
    });

    context('an older revision', () => {
      it('returns the RemoteParticipantV2', () => {
        const test = makeTest();
        const participantState = test.state(test.revision - 1);
        test.participant.update(participantState);
        assert.equal(
          test.revision,
          test.participant.revision);
      });

      it('does not update the .revision', () => {
        const test = makeTest();
        const participantState = test.state(test.revision - 1);
        test.participant.update(participantState);
        assert.equal(
          test.revision,
          test.participant.revision);
      });

      context('which includes a new trackState not matching an existing RemoteTrackPublicationV2', () => {
        it('does not construct a new RemoteTrackPublicationV2 from the trackState', () => {
          const test = makeTest();
          const participantState = test.state(test.revision - 1).setTrack({ sid: makeSid() });
          test.participant.update(participantState);
          assert.equal(0, test.remoteTrackPublicationV2s.length);
        });

        it('does not call getTrackTransceiver with a newly-constructed RemoteTrackPublicationV2\'s ID', () => {
          const test = makeTest();
          const participantState = test.state(test.revision - 1).setTrack({ sid: makeSid() });
          test.participant.update(participantState);
          assert(!test.getTrackTransceiver.calledOnce);
        });
      });

      context('which includes a trackState matching an existing RemoteTrackPublicationV2', () => {
        it('does not call update with the trackState on the existing RemoteTrackPublicationV2', () => {
          const sid = makeSid();
          const test = makeTest({ tracks: [{ sid }] });
          const participantState = test.state(test.revision - 1).setTrack({ sid });
          test.participant.update(participantState);
          assert(!test.remoteTrackPublicationV2s[0].update.calledTwice);
        });
      });

      context('which no longer includes a trackState matching an existing RemoteTrackPublicationV2', () => {
        it('does not delete the RemoteTrackPublicationV2 from the RemoteParticipantV2\'s .tracks Map', () => {
          const sid = makeSid();
          const test = makeTest({ tracks: [{ sid }] });
          const participantState = test.state(test.revision - 1);
          test.participant.update(participantState);
          assert.equal(
            test.remoteTrackPublicationV2s[0],
            test.participant.tracks.get(sid));
        });

        it('does not emit the "trackRemoved" event with the RemoteTrackPublicationV2', () => {
          const sid = makeSid();
          const test = makeTest({ tracks: [{ sid }] });
          const participantState = test.state(test.revision - 1);
          let trackRemoved;
          test.participant.once('trackRemoved', () => { trackRemoved = false; });
          test.participant.update(participantState);
          assert(!trackRemoved);
        });
      });

      combinationContext([
        [
          ['connected', 'reconnecting', 'disconnected'],
          x => `with .state set to "${x}" when the RemoteParticipantV2's .state is`
        ],
        [
          ['connected', 'reconnecting', 'disconnected'],
          x => `"${x}"`
        ]
      ], ([nextState, state]) => {
        it(`the .state should remain "${state}"`, () => {
          const test = makeTest({ state });
          const participantState = test.state(test.revision).setState(nextState);
          test.participant.update(participantState);
          assert.equal(test.participant.state, state);
        });

        it('should not emit "stateChanged" on the RemoteParticipantV2', () => {
          const test = makeTest({ state });
          const participantState = test.state(test.revision).setState(nextState);
          let stateChanged;
          test.participant.once('stateChanged', () => { stateChanged = true; });
          test.participant.update(participantState);
          assert(!stateChanged);
        });
      });

      context('which changes the .identity', () => {
        it('the .identity remains unchanged', () => {
          const test = makeTest();
          const participantState = test.state(test.revision - 1).setIdentity(makeIdentity());
          test.participant.update(participantState);
          assert.equal(
            test.identity,
            test.participant.identity);
        });
      });

      context('which changes the .sid', () => {
        it('the .identity remains unchanged', () => {
          const test = makeTest();
          const participantState = test.state(test.revision - 1).setSid(makeSid());
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
      const RemoteTrackPublicationV2 = makeRemoteTrackPublicationV2Constructor();
      const test = makeTest();
      const track = new RemoteTrackPublicationV2({ sid: makeSid() });
      assert.equal(
        test.participant,
        test.participant.addTrack(track));
    });

    it('adds the RemoteTrackPublicationV2 to the RemoteParticipantV2\'s .tracks Map', () => {
      const RemoteTrackPublicationV2 = makeRemoteTrackPublicationV2Constructor();
      const test = makeTest();
      const sid = makeSid();
      const track = new RemoteTrackPublicationV2({ sid });
      test.participant.addTrack(track);
      assert.equal(
        track,
        test.participant.tracks.get(sid));
    });

    it('emits the "trackAdded" event with the RemoteTrackPublicationV2', () => {
      const RemoteTrackPublicationV2 = makeRemoteTrackPublicationV2Constructor();
      const test = makeTest();
      const track = new RemoteTrackPublicationV2({ sid: makeSid() });
      let trackAdded;
      test.participant.once('trackAdded', track => { trackAdded = track; });
      test.participant.addTrack(track);
      assert.equal(
        track,
        trackAdded);
    });
  });

  describe('#connect', () => {
    context('when the RemoteParticipantV2\'s .state is "reconnecting"', () => {
      it('returns true', () => {
        const test = makeTest();
        test.participant.reconnecting();
        assert.equal(
          true,
          test.participant.connect(makeSid(), makeIdentity()));
      });

      it('the .identity remains the same', () => {
        const test = makeTest();
        test.participant.reconnecting();
        test.participant.connect(makeSid(), makeIdentity());
        assert.equal(
          test.identity,
          test.participant.identity);
      });

      it('the .sid remains the same', () => {
        const test = makeTest();
        test.participant.reconnecting();
        test.participant.connect(makeSid(), makeIdentity());
        assert.equal(
          test.sid,
          test.participant.sid);
      });

      it('the .state transitions "connected"', () => {
        const test = makeTest();
        test.participant.reconnecting();
        test.participant.connect(makeSid(), makeIdentity());
        assert.equal(
          'connected',
          test.participant.state);
      });

      it('emits the "stateChanged" event', () => {
        const test = makeTest();
        test.participant.reconnecting();
        let stateChanged;
        test.participant.once('stateChanged', () => { stateChanged = true; });
        test.participant.connect(makeSid(), makeIdentity());
        assert(stateChanged);
      });
    });

    context('when the RemoteParticipantV2\'s .state is "connected"', () => {
      it('returns false', () => {
        const test = makeTest();
        assert.equal(
          false,
          test.participant.connect(makeSid(), makeIdentity()));
      });

      it('the .identity remains the same', () => {
        const test = makeTest();
        test.participant.connect(makeSid(), makeIdentity());
        assert.equal(
          test.identity,
          test.participant.identity);
      });

      it('the .sid remains the same', () => {
        const test = makeTest();
        test.participant.connect(makeSid(), makeIdentity());
        assert.equal(
          test.sid,
          test.participant.sid);
      });

      it('the .state remains "connected"', () => {
        const test = makeTest();
        test.participant.connect(makeSid(), makeIdentity());
        assert.equal(
          'connected',
          test.participant.state);
      });

      it('does not emit the "stateChanged" event', () => {
        const test = makeTest();
        let stateChanged;
        test.participant.once('stateChanged', () => { stateChanged = true; });
        test.participant.connect(makeSid(), makeIdentity());
        assert(!stateChanged);
      });
    });

    context('when the RemoteParticipantV2\'s .state is "disconnected"', () => {
      it('returns false', () => {
        const test = makeTest();
        test.participant.disconnect();
        assert.equal(
          false,
          test.participant.connect(makeSid(), makeIdentity()));
      });

      it('the .identity remains the same', () => {
        const test = makeTest();
        test.participant.disconnect();
        test.participant.connect(makeSid(), makeIdentity());
        assert.equal(
          test.identity,
          test.participant.identity);
      });

      it('the .sid remains the same', () => {
        const test = makeTest();
        test.participant.disconnect();
        test.participant.connect(makeSid(), makeIdentity());
        assert.equal(
          test.sid,
          test.participant.sid);
      });

      it('the .state remains "disconnected"', () => {
        const test = makeTest();
        test.participant.disconnect();
        test.participant.connect(makeSid(), makeIdentity());
        assert.equal(
          'disconnected',
          test.participant.state);
      });

      it('does not emit the "stateChanged" event', () => {
        const test = makeTest();
        test.participant.disconnect();
        let stateChanged;
        test.participant.once('stateChanged', () => { stateChanged = true; });
        test.participant.connect(makeSid(), makeIdentity());
        assert(!stateChanged);
      });
    });
  });

  describe('#disconnect', () => {
    ['connected', 'reconnecting'].forEach(state => {
      context(`when the RemoteParticipantV2's .state is "${state}"`, () => {
        it('returns true', () => {
          const test = makeTest({ state });
          assert.equal(
            true,
            test.participant.disconnect());
        });

        it('sets the .state to "disconnected"', () => {
          const test = makeTest({ state });
          test.participant.disconnect();
          assert.equal(
            'disconnected',
            test.participant.state);
        });

        it('emits the "stateChanged" event with the new state "disconnected"', () => {
          const test = makeTest();
          let newState;
          test.participant.once('stateChanged', state => { newState = state; });
          test.participant.disconnect();
          assert.equal(
            'disconnected',
            newState);
        });
      });
    });

    context('when the RemoteParticipantV2\'s .state is "disconnected"', () => {
      it('returns false', () => {
        const test = makeTest();
        test.participant.disconnect();
        assert.equal(
          false,
          test.participant.disconnect());
      });

      it('the .state remains "disconnected"', () => {
        const test = makeTest();
        test.participant.disconnect();
        test.participant.disconnect();
        assert.equal(
          'disconnected',
          test.participant.state);
      });

      it('does not emit the "stateChanged" event', () => {
        const test = makeTest();
        test.participant.disconnect();
        let stateChanged;
        test.participant.once('stateChanged', () => { stateChanged = true; });
        test.participant.disconnect();
        assert(!stateChanged);
      });
    });
  });

  describe('#reconnecting', () => {
    context('when the RemoteParticipantV2\'s .state is "connected"', () => {
      it('should return true', () => {
        const test = makeTest();
        assert.equal(test.participant.reconnecting(), true);
      });

      it('should transition .state to "reconnecting"', () => {
        const test = makeTest();
        test.participant.reconnecting();
        assert.equal(test.participant.state, 'reconnecting');
      });

      it('should emit "stateChanged" on the RemoteParticipantV2', () => {
        const test = makeTest();
        let stateChanged;
        test.participant.once('stateChanged', () => { stateChanged = true; });
        test.participant.reconnecting();
        assert(stateChanged);
      });
    });

    ['reconnecting', 'disconnected'].forEach(state => {
      context(`when the RemoteParticipantV2's .state is "${state}"`, () => {
        it('should return false', () => {
          const test = makeTest({ state });
          assert.equal(test.participant.reconnecting(), false);
        });

        it('should not transition .state', () => {
          const test = makeTest({ state });
          test.participant.reconnecting();
          assert.equal(test.participant.state, state);
        });

        it('should emit "stateChanged" on the RemoteParticipantV2', () => {
          const test = makeTest({ state });
          let stateChanged;
          test.participant.once('stateChanged', () => { stateChanged = true; });
          test.participant.reconnecting();
          assert(!stateChanged);
        });
      });
    });
  });

  describe('#removeTrack', () => {
    context('when the RemoteTrackPublicationV2 to remove was previously added', () => {
      it('returns the removed RemoteTrackPublicationV2', () => {
        const test = makeTest({ tracks: [{ sid: makeSid() }] });
        assert.equal(
          test.remoteTrackPublicationV2s[0],
          test.participant.removeTrack(test.remoteTrackPublicationV2s[0]));
      });

      it('deletes the RemoteTrackPublicationV2 from the RemoteParticipantV2\'s .tracks Map', () => {
        const test = makeTest({ tracks: [{ sid: makeSid() }] });
        test.participant.removeTrack(test.remoteTrackPublicationV2s[0]);
        assert(!test.participant.tracks.has(test.remoteTrackPublicationV2s[0].sid));
      });

      it('emits the "trackRemoved" event with the RemoteTrackPublicationV2', () => {
        const test = makeTest({ tracks: [{ sid: makeSid() }] });
        let trackRemoved;
        test.participant.once('trackRemoved', track => { trackRemoved = track; });
        test.participant.removeTrack(test.remoteTrackPublicationV2s[0]);
        assert.equal(
          test.remoteTrackPublicationV2s[0],
          trackRemoved);
      });
    });

    context('when the RemoteTrackPublicationV2 to remove was not previously added', () => {
      it('returns false', () => {
        const RemoteTrackPublicationV2 = makeRemoteTrackPublicationV2Constructor();
        const track = new RemoteTrackPublicationV2({ sid: makeSid() });
        const test = makeTest();
        assert.equal(
          null,
          test.participant.removeTrack(track));
      });

      it('does not emit the "trackRemoved" event with the RemoteTrackPublicationV2', () => {
        const RemoteTrackPublicationV2 = makeRemoteTrackPublicationV2Constructor();
        const track = new RemoteTrackPublicationV2({ sid: makeSid() });
        const test = makeTest();
        let trackRemoved;
        test.participant.once('trackRemoved', () => { trackRemoved = true; });
        test.participant.removeTrack(track);
        assert(!trackRemoved);
      });
    });
  });
});

function makeIdentity() {
  return Math.random().toString(36).slice(2);
}

function makeSid() {
  let sid = 'PA';
  for (let i = 0; i < 32; i++) {
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
  options.state = options.state || 'connected';
  options.tracks = options.tracks || [];
  options.remoteTrackPublicationV2s = options.remoteTrackPublicationV2s || [];

  options.getTrackTransceiverDeferred = options.getTrackTransceiverDeferred
    || defer();
  options.getTrackTransceiver = options.getTrackTransceiver
    || sinon.spy(() => options.getTrackTransceiverDeferred.promise);
  options.RemoteTrackPublicationV2 = options.RemoteTrackPublicationV2 || makeRemoteTrackPublicationV2Constructor(options);

  options.getInitialTrackSwitchOffState = options.getInitialTrackSwitchOffState || sinon.spy(() => { return false; });
  options.setRenderHints = options.setRenderHints || sinon.spy(() => { return false; });
  options.setPriority = options.setPriority || sinon.spy(() => { return false; });
  options.participant = options.participant || makeRemoteParticipantV2(options);

  options.state = revision => {
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
  return new RemoteParticipantV2(options, options.getInitialTrackSwitchOffState, options.setPriority, options.setRenderHints, options);
}

function makeRemoteTrackPublicationV2Constructor(testOptions) {
  testOptions = testOptions || {};
  testOptions.remoteTrackPublicationV2s = testOptions.remoteTrackPublicationV2s || [];
  return function RemoteTrackPublicationV2(trackState, isSwitchedOff) {
    this.sid = trackState.sid;
    this.setTrackTransceiver = sinon.spy(() => {});
    this.update = sinon.spy(() => this);
    this.isSwitchedOff = isSwitchedOff;
    testOptions.remoteTrackPublicationV2s.push(this);
  };
}
