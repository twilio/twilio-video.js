'use strict';

const assert = require('assert');

const {
  connect,
  createLocalTracks,
  LocalDataTrack
} = require('../../../lib');

const {
  RoomCompletedError
} = require('../../../lib/util/twilio-video-errors');

const RemoteParticipant = require('../../../lib/remoteparticipant');
const { flatMap } = require('../../../lib/util');

const defaults = require('../../lib/defaults');
const { completeRoom, createRoom } = require('../../lib/rest');
const getToken = require('../../lib/token');

const {
  participantsConnected,
  randomName,
  trackStarted,
  tracksSubscribed,
  tracksPublished,
  waitForTracks
} = require('../../lib/util');

describe('Room', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);

  describe('disconnect', () => {
    let participants;
    let participantsBefore;
    let participantsAfter;
    let publicationsBefore;
    let publicationsAfter;
    let room;
    let rooms;
    let sid;
    let tracksBefore;
    let tracksAfter;
    let participantsDisconnected;
    let publicationsUnsubscribed;
    let tracksUnsubscribed;

    before(async () => {
      const identities = [randomName(), randomName(), randomName()];
      const tokens = identities.map(getToken);
      sid = await createRoom(randomName(), defaults.topology);
      rooms = await Promise.all(tokens.map(token => connect(token, Object.assign({ name: sid }, defaults))));
      await Promise.all(rooms.map(room => participantsConnected(room, rooms.length - 1)));

      await Promise.all(flatMap(rooms, room => [...room.participants.values()]).map(participant => {
        return tracksSubscribed(participant, participant.tracks.size);
      }));

      room = rooms[0];
      participants = [...room.participants.values()];
      participantsBefore = [...room.participants.keys()];
      publicationsBefore = [...room.participants.values()].sort().map(participant => [...participant.tracks.keys()].sort());
      tracksBefore = [...room.participants.values()].sort().map(participant => [...participant._tracks.keys()].sort());

      participantsDisconnected = Promise.all(rooms.slice(1).map(room => {
        return new Promise(resolve => room.once('participantDisconnected', resolve));
      }));

      publicationsUnsubscribed = Promise.all(flatMap(room.participants, participant => [...participant.tracks.values()]).map(publication => {
        return new Promise(resolve => publication.once('unsubscribed', resolve));
      }));

      tracksUnsubscribed = Promise.all(participants.map(participant => {
        const n = participant._tracks.size;
        return waitForTracks('trackUnsubscribed', participant, n);
      }));

      room.disconnect();

      participantsAfter = [...room.participants.keys()];
      publicationsAfter = [...room.participants.values()].sort().map(participant => [...participant.tracks.keys()].sort());
      tracksAfter = [...room.participants.values()].sort().map(participant => [...participant._tracks.keys()].sort());
    });

    after(() => {
      rooms.forEach(room => room && room.disconnect());
      return completeRoom(sid);
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

    it('should not change Room\'s Participant\'s .trackPublications', () => {
      assert.deepEqual(publicationsAfter, publicationsBefore);
    });

    it('should raise a "participantDisconnected" event for every other RemoteParticipant connected to the Room', async () => {
      await participantsDisconnected;
    });

    it('should raise a "unsubscribed" event on each RemoteParticipant\'s RemoteTrackPublicationss', async () => {
      await publicationsUnsubscribed;
    });

    it('should raise a "trackUnsubscribed" event for each RemoteParticipant\'s RemoteTracks', async () => {
      await tracksUnsubscribed;
    });
  });

  describe('getStats', function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(120000);

    let localDataTrack;
    let localMediaTracks;
    let localTrackPublications;
    let localTracks;
    let remoteTracks;
    let reports;
    let rooms;
    let sid;

    before(async () => {
      // 1. Get LocalTracks.
      localMediaTracks = await createLocalTracks();
      localDataTrack = new LocalDataTrack();
      localTracks = localMediaTracks.concat(localDataTrack);
      localTrackPublications = [null, null, null];

      // 2. Create Room.
      sid = await createRoom(randomName(), defaults.topology);

      rooms = await Promise.all(localTracks.map(async (localTrack, i) => {
        // 3. Connect to Room with specified LocalTrack.
        const identity = randomName();
        const token = getToken(identity);
        const room = await connect(token, Object.assign({
          name: sid,
          tracks: [localTrack]
        }, defaults));

        // 4. Wait for the LocalTrack to be published.
        await tracksPublished(room.localParticipant, 1, localTrack.kind);
        const localTrackPublication = [...room.localParticipant.tracks.values()].find(localTrackPublication => {
          return localTrackPublication.track === localTrack;
        });

        assert(localTrackPublication);
        localTrackPublications[i] = localTrackPublication;
        return room;
      }));

      await Promise.all(rooms.map(async room => {
        // 5. Wait for RemoteParticipants to connect.
        await participantsConnected(room, 2);
        const remoteParticipants = [...room.participants.values()];

        // 6. Wait for RemoteTracks to be published.
        await Promise.all(remoteParticipants.map(participant => tracksSubscribed(participant, 1)));
        const remoteTracksBySid = flatMap(remoteParticipants,
          remoteParticipant => [...remoteParticipant._tracks.values()])
          .reduce((remoteTracksBySid, remoteTrack) => remoteTracksBySid.set(remoteTrack.sid, remoteTrack), new Map());

        // NOTE(mroberts): By this point, localTrackPublications should include
        // the expected LocalTrackPublications. We had an issue before, where,
        // due to timing, it might not be populated.
        remoteTracks = localTrackPublications
          .map(localTrackPublication => remoteTracksBySid.get(localTrackPublication.trackSid))
          .filter(remoteTrack => remoteTrack);

        // 7. Wait for RemoteMediaTracks to be started.
        const remoteMediaTracks = remoteTracks.filter(remoteTrack => remoteTrack.kind !== 'data');
        await Promise.all(remoteMediaTracks.map(remoteMediaTrack => trackStarted(remoteMediaTrack)));

        return room;
      }));

      // 8. Get StatsReports.
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
          Object.entries(theseLocalTrackStats[0]).forEach(([, value]) => assert(typeof value !== 'undefined'));
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
      rooms.forEach(room => room && room.disconnect());
      return completeRoom(sid);
    });
  });

  describe('"disconnected" event', () => {
    it('is raised whenever the LocalParticipant is disconnected via the REST API', async () => {
      const sid = await createRoom(randomName(), defaults.topology);
      const room = await connect(getToken(randomName()), Object.assign({ name: sid }, defaults));
      const errorPromise = new Promise(resolve => room.once('disconnected', (room, error) => resolve(error)));
      await completeRoom(sid);
      const error = await errorPromise;
      assert(error instanceof RoomCompletedError);
    });
  });

  // eslint-disable-next-line
  (defaults.topology !== 'peer-to-peer' ? describe : describe.skip)('"dominantSpeakerChanged" event', () => {
    let options;
    let sid;
    let thisRoom;
    let thatRoom;
    let dominantSpeaker;

    before(async () => {
      sid = await createRoom(randomName(), defaults.topology);
      options = Object.assign({ name: sid }, defaults);
      thisRoom = await connect(getToken(randomName()), Object.assign({ tracks: [] }, options));
      const promise = new Promise(resolve => thisRoom.on('dominantSpeakerChanged', resolve));

      const tracks = typeof AudioContext !== 'undefined' && 'createMediaStreamDestination' in AudioContext.prototype ? (() => {
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const dest = audioContext.createMediaStreamDestination();
        oscillator.connect(dest);
        oscillator.start(0);
        return dest.stream.getTracks();
      })() : await createLocalTracks({ audio: true, fake: true });

      thatRoom = await connect(getToken(randomName()), Object.assign({ tracks }, options));
      dominantSpeaker = await promise;
    });

    it('is raised whenever the dominant speaker in the Room changes', () => {
      assert.equal(dominantSpeaker, thisRoom.participants.get(dominantSpeaker.sid));
    });

    after(() => {
      [thisRoom, thatRoom].forEach(room => room && room.disconnect());
      return completeRoom(sid);
    });
  });

  describe('"participantConnected" event', () => {
    let sid;
    let thisRoom;
    let thatRoom;
    let thisParticipant;
    let thatParticipant;

    before(async () => {
      sid = await createRoom(randomName(), defaults.topology);
      const options = Object.assign({ name: sid }, defaults);
      thisRoom = await connect(getToken(randomName()), options);
    });

    after(() => {
      [thisRoom, thatRoom].forEach(room => room && room.disconnect());
      return completeRoom(sid);
    });

    it('is raised whenever a RemoteParticipant connects to the Room', async () => {
      const participantConnected = new Promise(resolve => thisRoom.once('participantConnected', resolve));
      thatRoom = await connect(getToken(randomName()), Object.assign({ name: sid }, defaults));
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
    let publicationsBefore;
    let publicationsAfter;
    let publicationsUnsubscribed;
    let sid;
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
      sid = await createRoom(randomName(), defaults.topology);

      [thisRoom, thatRoom] = await Promise.all(tokens.map(token => connect(token, Object.assign({ name: sid }, defaults))));
      thisParticipant = thisRoom.localParticipant;

      await Promise.all(flatMap([thisRoom, thatRoom], room => participantsConnected(room, 1)));

      await Promise.all(flatMap([...thatRoom.participants.values()], participant =>
        tracksSubscribed(participant, thisParticipant._tracks.size)));

      const participantDisconnected = new Promise(resolve => thatRoom.once('participantDisconnected', resolve));

      thatParticipant = [...thatRoom.participants.values()][0];
      tracksBefore = [...thatParticipant._tracks.values()];
      publicationsBefore = [...thatParticipant.tracks.values()];

      const n = thatParticipant._tracks.size;
      tracksUnsubscribed = waitForTracks('trackUnsubscribed', thatParticipant, n);

      publicationsUnsubscribed = Promise.all([...thatParticipant.tracks.values()].map(publication => {
        return new Promise(resolve => publication.once('unsubscribed', resolve));
      }));

      thisRoom.disconnect();
      thatParticipant = await participantDisconnected;
      tracksAfter = [...thatParticipant._tracks.values()];
      publicationsAfter = [...thatParticipant.tracks.values()];
    });

    after(() => {
      [thisRoom, thatRoom].forEach(room => room && room.disconnect());
      return completeRoom(sid);
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

      it('should not change the RemoteParticipant\'s .tracks', () => {
        assert.deepEqual(tracksAfter, tracksBefore);
      });

      it('should not change Room\'s Participant\'s .trackPublications', () => {
        assert.deepEqual(publicationsAfter, publicationsBefore);
      });

      it('should raise a "unsubscribed" event on each RemoteParticipant\'s RemoteTrackPublicationss', async () => {
        await publicationsUnsubscribed;
      });

      it('should fire the "trackUnsubscribed" event for the RemoteParticipant\'s RemoteTracks', async () => {
        await tracksUnsubscribed;
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
