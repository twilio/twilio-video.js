'use strict';

const assert = require('assert');
const { trackPriority: { PRIORITY_HIGH, PRIORITY_LOW, PRIORITY_STANDARD } } = require('../../../lib/util/constants');
const LocalDataTrack = require('../../../lib/media/track/es5/localdatatrack');
const defaults = require('../../lib/defaults');
const { completeRoom } = require('../../lib/rest');
const { audio: createLocalAudioTrack, video: createLocalVideoTrack } = require('../../../lib/createlocaltrack');
const createLocalTracks = require('../../../lib/createlocaltrack');
const {
  createSyntheticAudioStreamTrack,
  setup,
  smallVideoConstraints,
  tracksSubscribed,
  trackSwitchedOff,
  trackSwitchedOn,
  trackPublishPriorityChanged,
  waitFor
} = require('../../lib/util');

['audio', 'video'].forEach(kind => {
  const createLocalTrack = createLocalTracks[kind];
  const description = 'Local' + kind[0].toUpperCase() + kind.slice(1) + 'Track';

  describe(description, function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(10000);

    let localTrack = null;

    beforeEach(() => {
      return createLocalTrack().then(_localTrack => {
        localTrack = _localTrack;
      });
    });

    afterEach(() => {
      localTrack.stop();
      localTrack = null;
    });

    describe('.isStopped', () => {
      context('before calling #stop', () => {
        it('.isStopped is false', () => {
          assert(!localTrack.isStopped);
        });
      });

      context('after calling #stop', () => {
        beforeEach(() => {
          localTrack.stop();
        });

        it('.isStopped is true', () => {
          assert(localTrack.isStopped);
        });
      });

      context('when the underlying MediaStreamTrack ends', () => {
        beforeEach(() => {
          localTrack.mediaStreamTrack.stop();
        });

        it('.isStopped is true', () => {
          assert(localTrack.isStopped);
        });
      });
    });

    describe('"stopped" event', () => {
      let stoppedEvent = null;

      beforeEach(() => {
        stoppedEvent = new Promise(resolve => {
          localTrack.once('stopped', resolve);
        });
      });

      afterEach(() => {
        stoppedEvent = null;
      });

      context('when #stop is called', () => {
        it('emits "stopped"', () => {
          localTrack.stop();
          return stoppedEvent;
        });
      });
    });
  });
});

describe('LocalParticipant', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);

  describe('#setPriority', () => {
    let thisRoom;
    let thoseRooms;
    let aliceLocal;
    let bobLocal;
    let aliceRemote;
    let bobRemote;
    let aliceTracks;
    let bobTracks;
    let aliceRemoteVideoTrack;
    let bobRemoteVideoTrack;
    let aliceLocalVideoTrackPublication;
    let bobLocalVideoTrackPublication;
    let aliceRemoteVideoTrackPublication;
    let bobRemoteVideoTrackPublication;

    beforeEach(async () => {
      const dataTrack = new LocalDataTrack();
      [, thisRoom, thoseRooms] = await setup({
        testOptions: {
          bandwidthProfile: {
            video: { maxTracks: 1, dominantSpeakerPriority: 'low' }
          },
          tracks: [dataTrack]
        },
        otherOptions: { tracks: [dataTrack] },
        nTracks: 0
      });

      [aliceTracks, bobTracks] = await Promise.all([1, 2, 3].map(async () => [
        createSyntheticAudioStreamTrack() || await createLocalAudioTrack({ fake: true }),
        await createLocalVideoTrack(smallVideoConstraints),
      ]));

      [aliceLocal, bobLocal] = thoseRooms.map(room => room.localParticipant);
      [aliceRemote, bobRemote] = [thisRoom.participants.get(aliceLocal.sid), thisRoom.participants.get(bobLocal.sid)];

      // Alice publishes her tracks at low priority
      // Bob publishes his tracks at standard priority
      await Promise.all([
        ...aliceTracks.map(track => aliceLocal.publishTrack(track, { priority: PRIORITY_LOW })),
        ...bobTracks.map(track => bobLocal.publishTrack(track, { priority: PRIORITY_STANDARD })),
        tracksSubscribed(aliceRemote, 3),
        tracksSubscribed(bobRemote, 3)
      ]);

      [aliceRemoteVideoTrack, bobRemoteVideoTrack] = [aliceRemote, bobRemote].map(({ videoTracks }) => {
        return [...videoTracks.values()][0].track;
      });

      [aliceLocalVideoTrackPublication, bobLocalVideoTrackPublication] = [aliceLocal, bobLocal].map(({ videoTracks }) => {
        return [...videoTracks.values()][0];
      });

      [aliceRemoteVideoTrackPublication, bobRemoteVideoTrackPublication] = [aliceRemote, bobRemote].map(({ videoTracks }) => {
        return [...videoTracks.values()][0];
      });

    });

    afterEach(async () => {
      [thisRoom, ...thoseRooms].forEach(room => room && room.disconnect());
      [...aliceTracks, ...bobTracks].forEach(track => track.stop && track.stop());
      if (thisRoom) {
        await completeRoom(thisRoom.sid);
      }
    });

    // eslint-disable-next-line no-warning-comments
    // TODO: enable these tests when track_priority MSP is available in prod
    if (defaults.topology !== 'peer-to-peer') {
      it('publisher can upgrade track\'s  priority', async () => {
        await waitFor([
          trackSwitchedOn(bobRemoteVideoTrack),
          trackSwitchedOff(aliceRemoteVideoTrack)
        ], 'Bobs track to get switched On, and Alice Switched Off');

        // Alice changes her track priority to high
        aliceLocalVideoTrackPublication.setPriority(PRIORITY_HIGH);

        // eslint-disable-next-line no-warning-comments
        // expect Alice's track to get switched on, and Bob's track to get switched off
        await waitFor([
          trackSwitchedOn(aliceRemoteVideoTrack),
          trackSwitchedOff(bobRemoteVideoTrack),
          trackPublishPriorityChanged(aliceRemoteVideoTrackPublication)
        ], 'Alice track to get switched On, and Bob Switched Off');
      });

      it('publisher can downgrade track\'s  priority', async () => {
        await waitFor([
          trackSwitchedOn(bobRemoteVideoTrack),
          trackSwitchedOff(aliceRemoteVideoTrack)
        ], 'Bobs track to get switched On, and Alice Switched Off');

        // Bob changes his track priority to low
        bobLocalVideoTrackPublication.setPriority(PRIORITY_LOW);

        // expect Alice's track to get switched on, and Bob's track to get switched off
        // also expect to receive publishPriorityChanged event on Bob's track.
        await waitFor([
          trackSwitchedOn(aliceRemoteVideoTrack),
          trackSwitchedOff(bobRemoteVideoTrack),
          trackPublishPriorityChanged(bobRemoteVideoTrackPublication)
        ], 'Alice track to get switched On, and Bob Switched Off');
      });
    }
  });
});


