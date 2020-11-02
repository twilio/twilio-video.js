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

const { isChrome, isSafari } = require('../../lib/guessbrowser');
const { audio: createLocalAudioTrack, video: createLocalVideoTrack } = require('../../../lib/createlocaltrack');
const RemoteParticipant = require('../../../lib/remoteparticipant');
const { flatMap, smallVideoConstraints } = require('../../../lib/util');

const defaults = require('../../lib/defaults');
const { completeRoom, createRoom, startRecording, stopRecording } = require('../../lib/rest');
const getToken = require('../../lib/token');
const { trackPriority: { PRIORITY_HIGH, PRIORITY_LOW } } = require('../../../lib/util/constants');

const {
  createSyntheticAudioStreamTrack,
  dominantSpeakerChanged,
  participantsConnected,
  randomName,
  setup,
  setupAliceAndBob,
  trackStarted,
  tracksSubscribed,
  tracksPublished,
  validateMediaFlow,
  waitFor,
  waitForNot,
  waitForSometime,
  waitForTracks
} = require('../../lib/util');

describe('Room', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);

  (defaults.topology === 'peer-to-peer' ? describe.skip : describe)('recording', () => {
    [true, false].forEach(trackSharedAtConnect => {
      [true, false].forEach(recordingEnabledAtCreate => {
        context(`when recording is ${recordingEnabledAtCreate ? 'enabled' : 'disabled'} and tracks ${trackSharedAtConnect ? 'published' : 'not published'} at connect `, () => {
          let room;
          let sid;
          let localTrack;
          const initialRecording = trackSharedAtConnect ? recordingEnabledAtCreate : false;
          before(async () => {
            sid = await createRoom(randomName(), defaults.topology, { RecordParticipantsOnConnect: recordingEnabledAtCreate });
            localTrack = await waitFor(createLocalVideoTrack(), 'alice local video track');
            const options = Object.assign({ name: sid, tracks: trackSharedAtConnect ? [localTrack] : [] }, defaults);
            room = await connect(getToken(randomName()), options);
          });

          it(`.isRecording should initially be set to ${initialRecording}`, () => {
            assert.strictEqual(room.isRecording, initialRecording);
          });

          if (!trackSharedAtConnect) {
            // publish track.
            it(`after track is published ${recordingEnabledAtCreate ? 'fires' : 'does not fire'} recordingStarted`, async () => {
              const recordingStartedPromise = new Promise(resolve => room.once('recordingStarted', resolve));
              await room.localParticipant.publishTrack(localTrack);

              if (recordingEnabledAtCreate) {
                await waitFor(recordingStartedPromise, `recording started: ${room.sid}`);
                assert.strictEqual(room.isRecording, true);
              } else {
                await waitForNot(recordingStartedPromise, `recording started: ${room.sid}`);
                assert.strictEqual(room.isRecording, false);
              }
            });
          }

          if (recordingEnabledAtCreate) {
            it('recordingStopped is raised whenever recording is stopped on the Room via the REST API', async () => {
              const recordingEventPromise = new Promise(resolve => room.once('recordingStopped', resolve));
              await stopRecording(room);
              await waitFor(recordingEventPromise, `failed to receive recordingStopped on ${room.sid}`);
              assert.strictEqual(room.isRecording, false);
            });
          } else {
            it('recordingStarted is raised whenever recording is started on the Room via the REST API', async () => {
              const recordingEventPromise = new Promise(resolve => room.once('recordingStarted', resolve));
              await startRecording(room);
              await waitFor(recordingEventPromise, `failed to receive recordingStarted on ${room.sid}`);
              assert.strictEqual(room.isRecording, true);
            });

            it('recordingStopped fires when track is unpublished', async () => {
              const recordingEventPromise = new Promise(resolve => room.once('recordingStopped', resolve));
              room.localParticipant.unpublishTrack(localTrack);

              await waitFor(recordingEventPromise, `failed to receive recordingStopped on ${room.sid}`);
              assert.strictEqual(room.isRecording, false);
            });
          }

          after(() => {
            if (room) {
              room.disconnect();
            }
            return completeRoom(sid);
          });
        });
      });
    });
  });

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

    it('should raise a "unsubscribed" event on each RemoteParticipant\'s RemoteTrackPublication', async () => {
      await publicationsUnsubscribed;
    });

    it('should raise a "trackUnsubscribed" event for each RemoteParticipant\'s RemoteTracks', async () => {
      await tracksUnsubscribed;
    });
  });

  [true, false].forEach(simulcastEnabled => {
    ((isChrome || isSafari) ? describe : describe.skip)(`getStats with VP8 Simulcast ${simulcastEnabled ? 'enabled' : 'not enabled'}`, function() {
      it(`returns ${simulcastEnabled ? 'multiple' : 'single'} LocalVideoTrackStats corresponding to the LocalVideoTrack`, async () => {
        const vp8SimulcastOptions = { preferredVideoCodecs: [{ codec: 'VP8', simulcast: true }] };
        const aliceLocalTracks = await createLocalTracks();
        const bobLocalTracks = await createLocalTracks();
        const aliceOptions = Object.assign({ tracks: aliceLocalTracks }, simulcastEnabled ? vp8SimulcastOptions : {});
        const bobOptions = { tracks: bobLocalTracks };
        const { roomSid, aliceRoom, bobRoom, aliceLocal, bobLocal, aliceRemote, bobRemote } = await setupAliceAndBob({ aliceOptions,  bobOptions });

        // wait for alice and bob to subscribe to tracks.
        await waitFor(tracksSubscribed(bobRemote, 2), `${aliceLocal.sid} to subscribe to Bob's RemoteTracks: ${roomSid}`);
        await waitFor(tracksSubscribed(aliceRemote, 2), `${bobLocal.sid} to subscribe to Alice's RemoteTracks: ${roomSid}`);

        await validateMediaFlow(aliceRoom);

        const aliceRoomStats = await aliceRoom.getStats();
        const bobRoomStats = await bobRoom.getStats();

        assert.equal(bobRoomStats.length, 1);
        assert.equal(bobRoomStats[0].remoteAudioTrackStats.length, 1);
        assert.equal(bobRoomStats[0].remoteVideoTrackStats.length, 1);
        assert.equal(bobRoomStats[0].localAudioTrackStats.length, 1);
        assert.equal(bobRoomStats[0].localVideoTrackStats.length, 1);

        assert.equal(aliceRoomStats.length, 1);
        assert.equal(aliceRoomStats[0].remoteAudioTrackStats.length, 1);
        assert.equal(aliceRoomStats[0].remoteVideoTrackStats.length, 1);
        assert.equal(aliceRoomStats[0].localAudioTrackStats.length, 1);

        if (simulcastEnabled) {
          assert(aliceRoomStats[0].localVideoTrackStats.length > 1);
          const aliceLocalTrack = aliceLocal.videoTracks.values().next().value;
          aliceRoomStats[0].localVideoTrackStats.forEach(localVideoTrackStats => {
            assert.equal(aliceLocalTrack.trackSid, localVideoTrackStats.trackSid);
            assert.equal(aliceLocalTrack.track.id, localVideoTrackStats.trackId);
          });
        } else {
          assert.equal(aliceRoomStats[0].localVideoTrackStats.length, 1);
        }
      });
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

      rooms = await waitFor(localTracks.map(async (localTrack, i) => {
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
      }), `rooms to get connected and track published: ${sid}`);

      await waitFor(rooms.map(async room => {
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
      }), `remote tracks to start: ${sid}`);

      // wait for sometime before retrieving stats
      await waitForSometime(2000);

      // 8. Get StatsReports.
      reports = await waitFor(rooms.map(room => room.getStats()), `stats reports ${sid}`);
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
          const localStatType = localTrackPublication.kind === 'audio' ? 'localAudioTrackStats' : 'localVideoTrackStats';
          const theseLocalTrackStats = report[localStatType];
          const thoseLocalTrackStats = localTrackPublication.kind === 'audio'
            ? report.localVideoTrackStats
            : report.localAudioTrackStats;
          assert.equal(theseLocalTrackStats.length, 1);
          assert.equal(thoseLocalTrackStats.length, 0);
          assert.equal(theseLocalTrackStats[0].trackId, localTracks[i].id);
          Object.entries(theseLocalTrackStats[0]).forEach(([, value]) => assert(typeof value !== 'undefined'));

          const trackStats = theseLocalTrackStats[0];
          [
            { key: 'ssrc', type: 'string', mustExist: true },
            { key: 'timestamp', type: 'number', mustExist: true },
            { key: 'bytesSent', type: 'number', mustExist: true },
            { key: 'packetsSent', type: 'number', mustExist: true },
            { key: 'trackId', type: 'string', mustExist: true },
            { key: 'roundTripTime', type: 'number', mustExist: true },
            { key: 'packetsLost', type: 'number', mustExist: false },
            { key: 'jitter', type: 'number', mustExist: false }
          ].forEach(({ key, type, mustExist }) => {
            // eslint-disable-next-line no-prototype-builtins
            const propertyExists = trackStats.hasOwnProperty(key);
            if (mustExist) {
              assert.equal(propertyExists, true);
            }
            if (propertyExists && trackStats[key] !== null) {
              assert.equal(typeof trackStats[key], type, `typeof ${localStatType}.${key} ("${typeof trackStats[key]}") should be "${type}"`);
            }
          });
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
  (defaults.topology !== 'peer-to-peer' ? describe : describe.skip)('"dominantSpeakerChanged" event', async () => {
    let options;
    let sid;
    let thatParticipant;
    let thisRoom;
    let thatRoom;

    before(async () => {
      sid = await createRoom(randomName(), defaults.topology);
      options = Object.assign({ name: sid }, defaults);
      thisRoom = await connect(getToken(randomName()), Object.assign({ tracks: [] }, options));

      const tracks = [createSyntheticAudioStreamTrack() || (await createLocalTracks({
        audio: true,
        fake: true
      }))[0]];

      thatRoom = await connect(getToken(randomName()), Object.assign({ tracks }, options));
      await participantsConnected(thisRoom, 1);
      thatParticipant = thisRoom.participants.get(thatRoom.localParticipant.sid);
    });

    it('is raised whenever the dominant speaker in the Room changes', async () => {
      await dominantSpeakerChanged(thisRoom, thatParticipant);
      assert.equal(thisRoom.dominantSpeaker, thatParticipant);
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
      // eslint-disable-next-line require-atomic-updates
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

      it('should raise a "unsubscribed" event on each RemoteParticipant\'s RemoteTrackPublication', async () => {
        await publicationsUnsubscribed;
      });

      it('should fire the "trackUnsubscribed" event for the RemoteParticipant\'s RemoteTracks', async () => {
        await tracksUnsubscribed;
      });
    });
  });


  (defaults.topology !== 'peer-to-peer' ? describe : describe.skip)('"trackSwitched" events', () => {
    let alice;
    let bob;
    let remoteBob;
    let charlie;
    let remoteCharlie;
    let aliceRoom = null;
    let bobRoom = null;
    let charlieRoom = null;
    let hiPriTrack;
    let loPriTrack;
    let loPriTrackPub;

    before(async () => {
      let thoseRooms;
      [, aliceRoom, thoseRooms] = await setup({
        testOptions: { tracks: [], bandwidthProfile: { video: { maxTracks: 1 } } },
        otherOptions: { tracks: [] },
        participantNames: ['Alice', 'Bob', 'Charlie'],
        nTracks: 0
      });

      [bobRoom, charlieRoom] = thoseRooms;
      alice = aliceRoom.localParticipant;
      bob = bobRoom.localParticipant;
      charlie = charlieRoom.localParticipant;

      // Create a high priority LocalTrack for charlie.
      hiPriTrack = await createLocalVideoTrack(smallVideoConstraints);

      // Let bob publish a LocalTrack with low priority.
      loPriTrack = await createLocalVideoTrack(smallVideoConstraints);
      await waitFor(bob.publishTrack(loPriTrack, { priority: PRIORITY_LOW }), `${bob.sid} to publish LocalTrack: ${aliceRoom.sid}`);
      remoteBob = aliceRoom.participants.get(bob.sid);

      await waitFor(tracksSubscribed(remoteBob, 1), `${alice.sid} to subscribe to Bob's RemoteoTrack: ${aliceRoom.sid}`);
      loPriTrackPub = Array.from(remoteBob.tracks.values())[0];
      remoteCharlie = aliceRoom.participants.get(charlie.sid);
    });

    after(() => {
      [aliceRoom, bobRoom, charlieRoom].forEach(room => room && room.disconnect());
      [hiPriTrack, loPriTrack].forEach(track => track && track.stop());
    });

    it('"trackSwitchedOff" fires on RemoteTrack ("switchedOff") RemoteTrackPublication, RemoteParticipant and Room', async () => {
      // 1) RemoteTrack
      const p1 = new Promise(resolve => loPriTrackPub.track.once('switchedOff', resolve));

      // 2) RemoteTrackPublication
      const p2 = new Promise(resolve => loPriTrackPub.once('trackSwitchedOff', track => {
        assert.equal(track, loPriTrackPub.track, 'unexpected value for the RemoteTrack');
        resolve();
      }));

      // 3) RemoteParticipant
      const p3 = new Promise(resolve => remoteBob.once('trackSwitchedOff', (track, trackPub) => {
        assert.equal(track, loPriTrackPub.track, 'unexpected value for the RemoteTrack');
        assert.equal(trackPub, loPriTrackPub, 'unexpected value for the RemoteTrackPublication');
        resolve();
      }));

      // 4) Room
      const p4 = new Promise(resolve => aliceRoom.once('trackSwitchedOff', (track, trackPub, participant) => {
        assert.equal(track, loPriTrackPub.track, 'unexpected value for the RemoteTrack');
        assert.equal(participant, remoteBob, 'unexpected value for the RemoteParticipant');
        assert.equal(trackPub, loPriTrackPub, 'unexpected value for the RemoteTrackPublication');
        resolve();
      }));

      // Induce a track switch off by having charlie publish a track with high priority.
      await waitFor(charlie.publishTrack(hiPriTrack, { priority: PRIORITY_HIGH }), `${charlie.sid} to publish a high priority LocalTrack: ${aliceRoom.sid}`);
      await waitFor(tracksSubscribed(remoteCharlie, 1), `${alice.sid} to subscribe to charlie's RemoteTrack ${hiPriTrack.sid}: ${aliceRoom.sid}`);

      // we should see track switch off event on all 4 objects.
      await waitFor([p1, p2, p3, p4], `trackSwitchedOff to get fired on RemoteTrack, RemoteTrackPublication, participant and room: ${aliceRoom.sid}`);
    });

    it('"trackSwitchedOn" fires on RemoteTrack ("switchedOn"), RemoteTrackPublication, RemoteParticipant and Room', async () => {
      // 1) RemoteTrack
      const p1 = new Promise(resolve => loPriTrackPub.track.once('switchedOn', resolve));

      // 2) RemoteTrackPublication
      const p2 = new Promise(resolve => loPriTrackPub.once('trackSwitchedOn', track => {
        assert.equal(track, loPriTrackPub.track, 'unexpected value for the RemoteTrack');
        resolve();
      }));

      // 3) RemoteParticipant
      const p3 = new Promise(resolve => remoteBob.once('trackSwitchedOn', (track, trackPub) => {
        assert.equal(track, loPriTrackPub.track, 'unexpected value for the RemoteTrack');
        assert.equal(trackPub, loPriTrackPub, 'unexpected value for the RemoteTrackPublication');
        resolve();
      }));

      // 4) Room
      const p4 = new Promise(resolve => aliceRoom.once('trackSwitchedOn', (track, trackPub, participant) => {
        assert.equal(track, loPriTrackPub.track, 'unexpected value for the RemoteTrack');
        assert.equal(participant, remoteBob, 'unexpected value for the RemoteParticipant');
        assert.equal(trackPub, loPriTrackPub, 'unexpected value for the RemoteTrackPublication');
        resolve();
      }));

      // Let Charlie unpublish the high priority LocalTrack.
      // NOTE(mmalavalli): This test fails if charlie disconnects from the Room, which might
      // be a potential bug.
      charlie.unpublishTrack(hiPriTrack);

      // Alice should see track switch on event on all 4 objects.
      await waitFor(p1, `Alice to receive "switchedOn" on Bob's RemoteVideoTrack: ${aliceRoom.sid}`);
      await waitFor(p2, `Alice to receive "trackSwitchedOn" on Bob's RemoteTrackPublication: ${aliceRoom.sid}`);
      await waitFor(p3, `Alice to receive "trackSwitchedOn" on Bob's RemoteParticipant: ${aliceRoom.sid}`);
      await waitFor(p4, `Alice to receive "trackSwitchedOn" on the Room: ${aliceRoom.sid}`);
    });
  });

  describe('VMS-2812: when local and remote sdp use different m-line order', () => {
    // these tests force the audio and video m-line order mismatch.
    // this would help catch issues like VMS-2812 in future.
    it('case 1: connected with different track order', async () => {
      const aliceTracks = await waitFor([createLocalAudioTrack(), createLocalVideoTrack()], 'alice local tracks');
      const bobTracks = await waitFor([createLocalVideoTrack(), createLocalAudioTrack()], 'bob local tracks');
      const aliceOptions = { tracks: aliceTracks };
      const bobOptions = { tracks: bobTracks };
      const { roomSid, aliceRoom, bobRoom } = await setupAliceAndBob({ aliceOptions,  bobOptions });

      const aliceAudio = validateMediaFlow(aliceRoom, 10000, ['remoteAudioTrackStats']);
      const aliceVideo = validateMediaFlow(aliceRoom, 10000, ['remoteVideoTrackStats']);

      const bobAudio = validateMediaFlow(bobRoom, 10000, ['remoteAudioTrackStats']);
      const bobVideo = validateMediaFlow(bobRoom, 10000, ['remoteVideoTrackStats']);

      await waitFor([aliceAudio, aliceVideo, bobAudio, bobVideo], `waiting to verify media in ${roomSid}`);
    });

    it('case 2: connected with video only and audio added later', async () => {
      const aliceLocalVideo = await waitFor(createLocalVideoTrack(), 'alice local video track');
      const aliceLocalAudio = await waitFor(createLocalAudioTrack(), 'alice local audio track');
      const aliceOptions = { tracks: [aliceLocalVideo] };
      const bobOptions = { tracks: [] };
      const { roomSid, aliceRoom, bobRoom } = await setupAliceAndBob({ aliceOptions,  bobOptions });
      await waitFor(aliceRoom.localParticipant.publishTrack(aliceLocalAudio), `alice to publish audio ${roomSid}`);

      const bobAudio = validateMediaFlow(bobRoom, 10000, ['remoteAudioTrackStats']);
      const bobVideo = validateMediaFlow(bobRoom, 10000, ['remoteVideoTrackStats']);

      await waitFor([bobAudio, bobVideo], `waiting to verify media in ${roomSid}`);
    });
  });
});
