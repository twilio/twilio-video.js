'use strict';

if (typeof window === 'undefined') {
  require('../../lib/mockwebrtc')();
}

const assert = require('assert');
const connect = require('../../../lib/connect');
const getToken = require('../../lib/token');
const { flatMap } = require('../../../lib/util');
const env = require('../../env');
const { participantsConnected, randomName, tracksAdded, waitForTracks } = require('../../lib/util');
const RemoteParticipant = require('../../../lib/remoteparticipant');

const options = ['ecsServer', 'logLevel', 'wsServer', 'wsServerInsights'].reduce((options, option) => {
  if (env[option] !== undefined) {
    options[option] = env[option];
  }
  return options;
}, {});

describe('Room', function() {
  this.timeout(60000);

  describe('disconnect', () => {
    let rooms;
    let room;
    let participants;
    let participantsBefore;
    let participantsAfter;
    let tracksBefore;
    let tracksAfter;
    let participantsDisconnected;
    let tracksUnsubscribed;

    before(async () => {
      const identities = [randomName(), randomName(), randomName()];
      const tokens = identities.map(getToken);
      const name = randomName();
      rooms = await Promise.all(tokens.map(token => connect(token, Object.assign({ name }, options))));
      await Promise.all(rooms.map(room => participantsConnected(room, rooms.length - 1)));

      room = rooms[0];
      participants = [...room.participants.values()];
      participantsBefore = [...room.participants.keys()];
      tracksBefore = [...room.participants.values()].sort().map(participant => [...participant.tracks.keys()].sort());

      participantsDisconnected = Promise.all(rooms.slice(1).map(room => {
        return new Promise(resolve => room.once('participantDisconnected', resolve));
      }));

      tracksUnsubscribed = Promise.all(participants.map(participant => {
        const n = participant.tracks.size;
        return waitForTracks('trackUnsubscribed', participant, n);
      }));

      room.disconnect();

      participantsAfter = [...room.participants.keys()];
      tracksAfter = [...room.participants.values()].sort().map(participant => [...participant.tracks.keys()].sort());
    });

    after(() => {
      rooms.forEach(room => room.disconnect());
    });

    it('should set the Room\'s LocalParticipant\'s .state to "disconnected"', () => {
      assert.equal(room.localParticipant.state, 'disconnected');
    });

    it('should not change the Room\'s .participants Map', () => {
      assert.deepEqual(participantsBefore, participantsAfter);
    });

    it('should not change Room\'s RemoteParticipant\'s .states', () => {
      room.participants.forEach(participant => assert.equal(participant.state, 'connected'));
    });

    it('should not change Room\'s Participant\'s .tracks', () => {
      assert.deepEqual(tracksAfter, tracksBefore);
    });

    it('should raise a "participantDisconnected" event for every other RemoteParticipant connected to the Room', async () => {
      await participantsDisconnected;
    });

    it('should raise a "trackUnsubscribed" event for each RemoteParticipant\'s RemoteTracks', async () => {
      await tracksUnsubscribed;
    });
  });

  describe('getStats', () => {
    let localDataTrack;
    let localMediaTracks;
    let localTrackPublications;
    let localTracks;
    let remoteTracks;
    let reports;
    let rooms;

    before(async () => {
      // 1. Get LocalTracks.
      localMediaTracks = await createLocalTracks();
      localDataTrack = new LocalDataTrack();
      localTracks = localMediaTracks.concat(localDataTrack);
      localTrackPublications = [null, null, null];

      const name = randomName();
      rooms = await Promise.all(localTracks.map(async (localTrack, i) => {
        // 2. Connect to Room with specified LocalTrack.
        const identity = randomName();
        const token = getToken(identity);
        const room = await connect(token, Object.assign({
          name,
          tracks: [localTrack]
        }, defaults));

        // 3. Wait for the LocalTrack to be published.
        await tracksPublished(room.localParticipant, 1, localTrack.kind);
        const localTrackPublication = [...room.localParticipant.trackPublications.values()].find(localTrackPublication => {
          return localTrackPublication.track === localTrack;
        });
        assert(localTrackPublication);
        localTrackPublications[i] = localTrackPublication;

        return room;
      }));

      await Promise.all(rooms.map(async room => {
        // 4. Wait for RemoteParticipants to connect.
        await participantsConnected(room, 2);
        const remoteParticipants = [...room.participants.values()];

        // 5. Wait for RemoteTracks to be published.
        await Promise.all(remoteParticipants.map(participant => tracksAdded(participant, 1)));
        const remoteTracksBySid = flatMap(remoteParticipants,
          remoteParticipant => [...remoteParticipant.tracks.values()])
          .reduce((remoteTracksBySid, remoteTrack) => remoteTracksBySid.set(remoteTrack.sid, remoteTrack), new Map());

        // NOTE(mroberts): By this point, localTrackPublications should include
        // the expected LocalTrackPublications. We had an issue before, where,
        // due to timing, it might not be populated.
        remoteTracks = localTrackPublications
          .map(localTrackPublication => remoteTracksBySid.get(localTrackPublication.trackSid))
          .filter(remoteTrack => remoteTrack);

        // 6. Wait for RemoteMediaTracks to be started.
        const remoteMediaTracks = remoteTracks.filter(remoteTrack => remoteTrack.kind !== 'data');
        await Promise.all(remoteMediaTracks.map(remoteMediaTrack => trackStarted(remoteMediaTrack)));

        return room;
      }));

      // 7. Get StatsReports.
      reports = await Promise.all(rooms.map(room => room.getStats()));
    });

    it('includes the expected LocalAudioTrackStats and LocalVideoTrackStats', () => {
      reports.forEach((reports, i) => {
        // 1. Skip over LocalDataTracks.
        const localTrackPublication = localTrackPublications[i];
        if (localTrackPublication.kind === 'data') {
          return;
        }
        reports.forEach(report => {
          // 2. Ensure that, if we connected with a LocalAudioTrack, we only
          //    have an entry for localAudioTrackStats (and similarly for
          //    video).
          const theseLocalTrackStats = localTrackPublication.kind === 'audio'
            ? report.localAudioTrackStats
            : report.localVideoTrackStats;
          const thoseLocalTrackStats = localTrackPublication.kind === 'audio'
            ? report.localVideoTrackStats
            : report.localAudioTrackStats;
          assert.equal(theseLocalTrackStats.length, 1);
          assert.equal(thoseLocalTrackStats.length, 0);
          assert.equal(theseLocalTrackStats[0].trackId, localTracks[i].id);
        });
      });
    });

    it('includes the expected RemoteAudioTrackStats and RemoteVideoTrackStats', () => {
      reports.forEach((reports, i) => {
        const localTrackPublication = localTrackPublications[i];
        remoteTracks.forEach(remoteTrack => {
          // 1. Skip over RemoteDataTracks and any RemoteTrack we may be publishing.
          if (remoteTrack.kind === 'data' || remoteTrack.sid === localTrackPublication.trackSid) {
            return;
          }
          // 2. Ensure that, if we are subscribed to a LocalAudioTrack, we only
          //    have an entry for remoteAudioTrackStats (and similarly for
          //    video).
          const remoteTrackStats = remoteTrack.kind === 'audio'
            ? flatMap(reports, report => report.remoteAudioTrackStats)
            : flatMap(reports, report => report.remoteVideoTrackStats);
          const remoteTrackIds = new Set(remoteTrackStats.map(remoteTrackStat => remoteTrackStat.trackId));
          assert.equal(remoteTrackIds.size, 1);
        });
      });
    });

    after(() => {
      localMediaTracks.forEach(localMediaTrack => localMediaTrack.stop());
      rooms.forEach(room => room.disconnect());
    });
  });

  describe('"disconnected" event', () => {
    it.skip('is raised whenever the LocalParticipant is disconnected via the REST API', () => {
      // TODO(mroberts): POST to the REST API to disconnect the LocalParticipant from the Room.
    });
  });

  describe('"participantConnected" event', () => {
    let thisRoom;
    let thatRoom;
    let thisParticipant;
    let thatParticipant;

    before(async () => {
      thisRoom = await connect(getToken(randomName()), options);
    });

    after(() => {
      thisRoom.disconnect();
      if (thatRoom) {
        thatRoom.disconnect();
      }
    });

    it('is raised whenever a RemoteParticipant connects to the Room', async () => {
      const participantConnected = new Promise(resolve => thisRoom.once('participantConnected', resolve));
      thatRoom = await connect(getToken(randomName()), Object.assign({ name: thisRoom.name }, options));
      thisParticipant = await participantConnected;
      thatParticipant = thatRoom.localParticipant;
      assert(thisParticipant instanceof RemoteParticipant);
      assert.equal(thisParticipant.sid, thatParticipant.sid);
      assert.equal(thisParticipant.identity, thatParticipant.identity);
    });

    describe('is raised whenever a RemoteParticipant connects to the Room and', () => {
      it('should add the RemoteParticipant to the Room\'s .participants Map', () => {
        assert.equal(thisRoom.participants.get(thisParticipant.sid), thisParticipant);
      });

      it('should set the RemoteParticipant\'s .state to "connected"', () => {
        assert(thisParticipant.state, 'connected');
      });
    });
  });

  describe('"participantDisconnected" event', () => {
    let thisRoom;
    let thatRoom;
    let thisParticipant;
    let thatParticipant;
    let tracksAfter;
    let tracksBefore;
    let tracksUnsubscribed;

    before(async () => {
      const identities = [randomName(), randomName()];
      const tokens = identities.map(getToken);
      const name = randomName();

      [thisRoom, thatRoom] = await Promise.all(tokens.map(token => connect(token, Object.assign({ name }, options))));
      thisParticipant = thisRoom.localParticipant;

      await Promise.all(flatMap([thisRoom, thatRoom], room => participantsConnected(room, 1)));

      if (navigator.userAgent !== 'Node') {
        await Promise.all(flatMap([...thatRoom.participants.values()], participant =>
          tracksAdded(participant, thisParticipant.tracks.size)));
      }

      const participantDisconnected = new Promise(resolve => thatRoom.once('participantDisconnected', resolve));

      thatParticipant = [...thatRoom.participants.values()][0];
      tracksBefore = [...thatParticipant.tracks.values()];

      const n = thatParticipant.tracks.size;
      tracksUnsubscribed = waitForTracks('trackUnsubscribed', thatParticipant, n);

      thisRoom.disconnect();

      thatParticipant = await participantDisconnected;
      tracksAfter = [...thatParticipant.tracks.values()];
    });

    after(() => {
      thisRoom.disconnect();
      thatRoom.disconnect();
    });

    it('is raised whenever a RemoteParticipant disconnects from the Room', () => {
      assert(thatParticipant instanceof RemoteParticipant);
      assert.equal(thatParticipant.sid, thisParticipant.sid);
      assert.equal(thatParticipant.identity, thisParticipant.identity);
    });

    describe('is raised whenever a RemoteParticipant disconnects from the Room and', () => {
      it('should delete the RemoteParticipant from the Room\'s .participants Map', () => {
        assert(!thatRoom.participants.has(thatParticipant.sid));
      });

      it('should set the RemoteParticipant\'s .state to "disconnected"', () => {
        assert.equal(thatParticipant.state, 'disconnected');
      });

      it('should fire the "trackUnsubscribed" event for the RemoteParticipant\'s RemoteTracks', async () => {
        await tracksUnsubscribed;
      });

      it('should not change the RemoteParticipant\'s .tracks', () => {
        assert.deepEqual(tracksAfter, tracksBefore);
      });
    });
  });

  describe('"recordingStarted" event', () => {
    it.skip('is raised whenever recording is started on the Room via the REST API', () => {
      // TODO(mroberts): POST to the REST API to start recording on the Room.
    });
  });

  describe('"recordingStopped" event', () => {
    it.skip('is raised whenever recording is stopped on the Room via the REST API', () => {
      // TODO(mroberts): POST to the REST API to stop recording on the Room.
    });
  });
});
