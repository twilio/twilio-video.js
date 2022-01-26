/* eslint-disable no-console */
/* eslint-disable no-undefined */
'use strict';

const assert = require('assert');
const defaults = require('../../../lib/defaults');
const { Logger, connect, createLocalVideoTrack } = require('../../../../es5');
const { createRoom, completeRoom } = require('../../../lib/rest');
const getToken = require('../../../lib/token');
const { isFirefox } = require('../../../lib/guessbrowser');

const {
  tracksSubscribed,
  trackSwitchedOff,
  trackSwitchedOn,
  waitFor,
  participantsConnected,
  setupAliceAndBob,
  randomName,
  waitForSometime,
} = require('../../../lib/util');

// for a given stat reports returns a Map<ssrc, LocalVideoTrackStats>
async function getSimulcastLayerReport(room) {
  const statReports = await room.getStats();
  const ssrcToLocalVideoTrackStats = new Map();
  statReports.forEach(statReport => {
    statReport.localVideoTrackStats.forEach(trackStat => {
      ssrcToLocalVideoTrackStats.set(trackStat.ssrc, trackStat);
    });
  });
  return ssrcToLocalVideoTrackStats;
}

// for a given room, returns array of simulcast layers that are active.
// it checks for active layers by gathering layer stats 1 sec apart.
async function getActiveLayers({ room, initialWaitMS = 5000, activeTimeMS = 3000 }) {
  await waitForSometime(initialWaitMS);
  const layersBefore = await getSimulcastLayerReport(room);
  await waitForSometime(activeTimeMS);
  const layersAfter = await getSimulcastLayerReport(room);

  const activeLayers = [];
  const inactiveLayers = [];
  Array.from(layersAfter.keys()).forEach(ssrc => {
    const layerStatsAfter = layersAfter.get(ssrc);
    const layerStatsBefore = layersBefore.get(ssrc);
    const bytesSentAfter = layerStatsAfter.bytesSent;
    const bytesSentBefore = layerStatsBefore ? layerStatsBefore.bytesSent : 0;
    const diffBytes = bytesSentAfter - bytesSentBefore;
    const dimensions = layerStatsAfter.dimensions;
    if (diffBytes > 0) {
      activeLayers.push({ dimensions, diffBytes });
    } else {
      inactiveLayers.push({ dimensions, diffBytes });
    }
  });

  console.log(`activeLayers ${JSON.stringify(activeLayers)}`);
  console.log(`inactiveLayers ${JSON.stringify(inactiveLayers)}`);
  return { activeLayers, inactiveLayers };
}

describe('preferredVideoCodecs = auto', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(120 * 1000);
  // eslint-disable-next-line no-invalid-this
  this.retries(2);
  if (defaults.topology === 'peer-to-peer') {
    describe('reverts to unicast', () => {
      let roomSid;
      let aliceRemote;
      let aliceRoom;
      let bobRoom;
      let  aliceLocalVideo;
      let bobLocalVideo;
      before(async () => {
        aliceLocalVideo = await waitFor(createLocalVideoTrack(), 'alice local video track');
        bobLocalVideo = await waitFor(createLocalVideoTrack(), 'bob local video track');
        const bandwidthProfile = {
          video: {
            contentPreferencesMode: 'manual',
            clientTrackSwitchOffControl: 'manual'
          }
        };

        const aliceOptions = {
          tracks: [aliceLocalVideo],
          preferredVideoCodecs: 'auto',
          loggerName: 'AliceLogger',
          bandwidthProfile
        };

        const bobOptions = {
          preferredVideoCodecs: 'auto',
          tracks: [bobLocalVideo],
          loggerName: 'BobLogger',
          bandwidthProfile
        };

        ({ roomSid, aliceRemote, aliceRoom, bobRoom } = await setupAliceAndBob({ aliceOptions,  bobOptions }));
      });
      after(() => {
        [aliceRoom, bobRoom].forEach(room => room && room.disconnect());
        [aliceLocalVideo, bobLocalVideo].forEach(video => video.stop());
      });

      it('should fall back to unicast', async () => {
        console.log({ roomSid, aliceRemote, aliceRoom, bobRoom });
        await waitFor(tracksSubscribed(aliceRemote, 1), `Bob to subscribe to Alice's track: ${roomSid}`);
        await waitFor(tracksSubscribed(aliceRemote, 1), `Alice to subscribe to Bob's track: ${roomSid}`);

        await waitForSometime(5000);

        const aliceSimulcastLayers = await getSimulcastLayerReport(aliceRoom);
        const bobSimulcastLayers = await getSimulcastLayerReport(bobRoom);

        assert(aliceSimulcastLayers.size === 1);
        assert(bobSimulcastLayers.size === 1);
      });
    });
  } else {
    [
      {
        testCase: 'enables simulcast for VP8 rooms',
        roomOptions: { VideoCodecs: ['VP8'] },
        expectedCodec: 'VP8',
        expectedLayers: 3
      },
      {
        testCase: 'does not enable simulcast for H264 rooms',
        roomOptions: { VideoCodecs: ['H264'] },
        expectedCodec: 'H264',
      },
    ].forEach(({ testCase, roomOptions, expectedCodec, expectedLayers }) => {
      // firefox does not support simulcast.
      (isFirefox ? it.skip : it)(testCase, async () => {
        const roomSid = await createRoom(randomName(), defaults.topology, roomOptions);
        const aliceLocalVideo = await waitFor(createLocalVideoTrack(), 'alice local video track');
        const room = await connect(getToken('Alice'), {
          ...defaults,
          tracks: [aliceLocalVideo],
          name: roomSid,
          loggerName: 'AliceLogger',
          preferredVideoCodecs: 'auto',
          bandwidthProfile: {
            video: {
              contentPreferencesMode: 'manual',
              clientTrackSwitchOffControl: 'manual'
            }
          }
        });

        await waitForSometime(2000);
        const simulcastLayers = await getSimulcastLayerReport(room);
        const layerArray = Array.from(simulcastLayers.values());
        layerArray.forEach(layer => layer.codec === expectedCodec);
        if (expectedLayers) {
          assert.strictEqual(layerArray.length, expectedLayers, `layers: ${layerArray.length}, expected: ${expectedLayers} : room: ${roomSid}`);
        }
        completeRoom(roomSid);
        aliceLocalVideo.stop();
      });
    });
  }
});

if (defaults.topology !== 'peer-to-peer' && !isFirefox) {
  describe('adaptive simulcast', function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(120 * 1000);

    let roomSid = null;
    let aliceVideoTrackPublication = null;
    let aliceRemoteVideoForBob = null;
    let aliceRoom = null;
    const bandwidthProfile = { video: { contentPreferencesMode: 'manual', clientTrackSwitchOffControl: 'manual' } };
    before(async () => {
      roomSid = await createRoom(randomName(), defaults.topology);
    });
    after(() => {
      completeRoom(roomSid);
      roomSid = null;
    });

    context('Alice joins the room', () => {
      let aliceLocalVideo;
      before(async () => {
        aliceLocalVideo = await waitFor(createLocalVideoTrack({ width: 1280, height: 720 }), 'alice local video track');
        const { height, width } = aliceLocalVideo.mediaStreamTrack.getSettings();
        assert.strictEqual(height, 720);
        assert.strictEqual(width, 1280);
        aliceRoom = await connect(getToken('Alice'), {
          ...defaults,
          tracks: [aliceLocalVideo],
          name: roomSid,
          loggerName: 'AliceLogger',
          preferredVideoCodecs: 'auto',
          bandwidthProfile
        });
        Logger.getLogger('AliceLogger').setLevel('WARN');
        console.log(`Alice joined the room: ${roomSid}: ${aliceRoom.localParticipant.sid}`);
      });

      describe('While Alice is alone in the room', () => {
        it('c1: all layers get turned off.', async () => {
          const { activeLayers } = await getActiveLayers({ room: aliceRoom });
          assert(activeLayers.length === 0, `was expecting expectedActiveLayers=0 but found: ${activeLayers.length} in ${roomSid}`);
        });
      });

      context('Bob joins the room', () => {
        let bobRoom = null;
        before(async () => {
          aliceVideoTrackPublication = [...aliceRoom.localParticipant.tracks.values()][0];
          bobRoom = await connect(getToken('Bob'), {
            ...defaults,
            tracks: [],
            name: roomSid,
            loggerName: 'BobLogger',
            preferredVideoCodecs: 'auto',
            bandwidthProfile
          });
          console.log(`Bob joined the room: ${roomSid}: ${bobRoom.localParticipant.sid}`);
          Logger.getLogger('BobLogger').setLevel('ERROR');

          await waitFor(participantsConnected(bobRoom, 1), `wait for Bob to see alice: ${roomSid}`);
          const aliceRemote = bobRoom.participants.get(aliceRoom.localParticipant.sid);
          await waitFor(tracksSubscribed(aliceRemote, 1), `wait for Bob to see alice's track: ${roomSid}`);
          aliceRemoteVideoForBob = aliceRemote.videoTracks.get(aliceVideoTrackPublication.trackSid).track;
        });

        [
          {
            testCase: 'c2: layers get turned on',
            bob: {  }, // no action yet.
            expectedActiveLayers: layers => layers >= 2
          },
          {
            testCase: 'c3: Bob switches off',
            bob: { switchOff: true, switchOn: false },
            expectedActiveLayers: layers => layers === 0
          },
          {
            testCase: 'c4 bob switch on and renders @ 1280x720',
            bob: { switchOff: false, switchOn: true, renderDimensions: { width: 1280, height: 720 } },
            expectedActiveLayers: layers => layers >= 2
          },
          {
            testCase: 'c5: Bob request 640x360',
            bob: { renderDimensions: { width: 640, height: 360 } },
            expectedActiveLayers: layers => layers === 2
          },
          {
            testCase: 'c6: Bob request 320x180',
            bob: { renderDimensions: { width: 320, height: 180 } },
            expectedActiveLayers: layers => layers === 1
          },
          {
            testCase: 'c7: Bob switches off',
            bob: { switchOff: true },
            expectedActiveLayers: layers => layers === 0
          },
        ].forEach(({ testCase, bob, expectedActiveLayers }) => {
          it(testCase, async () => {
            console.log(`executing ${testCase}`);
            await executeRemoteTrackActions(bob, aliceRemoteVideoForBob, 'Bob');
            const { activeLayers } = await getActiveLayers({ room: aliceRoom });
            assert(expectedActiveLayers(activeLayers.length), `unexpected activeLayers.length: ${activeLayers.length} in ${roomSid}`);
          });
        });
        context('Charlie joins the room', () => {
          let charlieRoom = null;
          let aliceRemoteVideoForCharlie = null;
          before(async () => {
            charlieRoom = await connect(getToken('Charlie'), {
              ...defaults,
              tracks: [],
              name: roomSid,
              loggerName: 'CharlieLogger',
              preferredVideoCodecs: 'auto',
              bandwidthProfile
            });
            console.log(`Charlie joined the room: ${roomSid}: ${charlieRoom.localParticipant.sid}`);
            Logger.getLogger('CharlieLogger').setLevel('ERROR');

            await waitFor(participantsConnected(charlieRoom, 2), `wait for Bob to see alice and Bob: ${roomSid}`);
            const aliceRemote = charlieRoom.participants.get(aliceRoom.localParticipant.sid);
            await waitFor(tracksSubscribed(aliceRemote, 1), `wait for Charlie to see alice's track: ${roomSid}`);
            aliceRemoteVideoForCharlie = aliceRemote.videoTracks.get(aliceVideoTrackPublication.trackSid).track;
          });
          [
            {
              testCase: 'c8: Charlie joined (no render hints yet)',
              expectedActiveLayers: layers => layers >= 2
            },
            {
              testCase: 'c9: Charlie requests 320x180',
              charlie: { switchOff: false, switchOn: true, renderDimensions: { width: 320, height: 180 } },
              expectedActiveLayers: layers => layers === 1
            },
            {
              testCase: 'c10 Charlie Switches off',
              charlie: { switchOff: true },
              expectedActiveLayers: layers => layers === 0
            },
            {
              testCase: 'c11: Bob requests 1280x720',
              bob: { switchOn: true, renderDimensions: { width: 1280, height: 720 } },
              expectedActiveLayers: layers => layers >= 2
            },
            {
              testCase: 'c12: Charlie requests 1280x720',
              charlie: { switchOn: true, renderDimensions: { width: 1280, height: 720 } },
              expectedActiveLayers: layers => layers >= 2
            },
            {
              testCase: 'c13: Charlie switches off, Bob: 640x360',
              bob: { renderDimensions: { width: 640, height: 360 } },
              charlie: { switchOff: true },
              expectedActiveLayers: layers => layers === 2
            },
            {
              testCase: 'c14: Charlie SwitchOn @ 320x180, Bob switch off',
              bob: { switchOff: true },
              charlie: { switchOn: true, renderDimensions: { width: 320, height: 180 } },
              expectedActiveLayers: layers => layers === 1
            },
            {
              testCase: 'c15: Charlie switches off',
              charlie: { switchOff: true },
              expectedActiveLayers: layers => layers === 0
            },
          ].forEach(({ testCase, bob, charlie, expectedActiveLayers }) => {
            it(testCase, async () => {
              console.log(`executing ${testCase}`);
              await executeRemoteTrackActions(bob, aliceRemoteVideoForBob, 'Bob');
              await executeRemoteTrackActions(charlie, aliceRemoteVideoForCharlie, 'Charlie');

              const { activeLayers } = await getActiveLayers({ room: aliceRoom });
              assert(expectedActiveLayers(activeLayers.length), `unexpected activeLayers.length: ${activeLayers.length} in ${roomSid}`);
            });
          });

          it('adaptive simulcast continue to work after replace track', async () => {
            // have both bob and charlie turn off tracks.
            await executeRemoteTrackActions({ switchOff: true }, aliceRemoteVideoForBob, 'Bob');
            await executeRemoteTrackActions({ switchOff: true }, aliceRemoteVideoForCharlie, 'Charlie');
            let { activeLayers } = await getActiveLayers({ room: aliceRoom });

            assert(activeLayers.length === 0, `unexpected activeLayers.length after switch off #1: ${activeLayers.length} in ${roomSid}`);

            // now restart the track
            console.log('restarting the track');
            await aliceLocalVideo.restart();

            // have bob switch on and off tracks again to retrigger SFU.
            await executeRemoteTrackActions({ switchOn: true }, aliceRemoteVideoForBob, 'Bob');
            await executeRemoteTrackActions({ switchOff: true }, aliceRemoteVideoForBob, 'Bob');

            ({ activeLayers } = (await getActiveLayers({ room: aliceRoom })));
            assert(activeLayers.length === 0, `unexpected activeLayers.length after switchOff #2: ${activeLayers.length} in ${roomSid}`);
          });
        });
      });
    });
  });
}
async function executeRemoteTrackActions(actions, remoteTrack, actor) {
  if (actions) {
    if (actions.switchOn) {
      console.log(`${actor} switching on`);
      remoteTrack.switchOn();
      await waitFor(trackSwitchedOn(remoteTrack), `track to switch on: ${remoteTrack.sid}`);
    }
    if (actions.switchOff) {
      console.log(`${actor} switching off`);
      remoteTrack.switchOff();
      await waitFor(trackSwitchedOff(remoteTrack), `track to switch off: ${remoteTrack.sid}`);
    }
    if (actions.renderDimensions) {
      console.log(`${actor} setting renderDimensions`, actions.renderDimensions);
      remoteTrack.setContentPreferences({ renderDimensions: actions.renderDimensions });
    }
  }
}
