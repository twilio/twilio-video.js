/* eslint-disable no-console */
/* eslint-disable no-undefined */
'use strict';

const assert = require('assert');
const { video: createLocalVideoTrack } = require('../../../../es5/createlocaltrack');
const defaults = require('../../../lib/defaults');
const { Logger } = require('../../../../es5');
const connect = require('../../../../es5/connect');
const { createRoom, completeRoom } = require('../../../lib/rest');
const getToken = require('../../../lib/token');
// const connect = require('../../../../es5/connect');

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
async function getActiveLayers({ room, initialWaitMS = 10000, activeTimeMS = 5000 }) {
  console.log('waiting ', initialWaitMS);
  await waitForSometime(initialWaitMS);
  console.log('done waiting ', initialWaitMS);
  const layersBefore = await getSimulcastLayerReport(room);
  console.log('waiting ', activeTimeMS);
  await waitForSometime(activeTimeMS);
  console.log('done waiting ', activeTimeMS);
  const layersAfter = await getSimulcastLayerReport(room);

  const activeLayers = [];
  Array.from(layersAfter.keys()).forEach(ssrc => {
    const layerStatsAfter = layersAfter.get(ssrc);
    const layerStatsBefore = layersBefore.get(ssrc);
    const bytesSentAfter = layerStatsAfter.bytesSent;
    const bytesSentBefore = layerStatsBefore ? layerStatsBefore.bytesSent : 0;
    if (bytesSentAfter > bytesSentBefore) {
      const diffBytes = bytesSentAfter - bytesSentBefore;
      const dimensions = layerStatsAfter.dimensions;
      activeLayers.push({ dimensions, diffBytes });
    }
  });
  return activeLayers;
}

describe('preferredVideoCodecs = auto', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(120 * 1000);
  // eslint-disable-next-line no-invalid-this
  // this.retries(2);
  if (defaults.topology === 'peer-to-peer') {
    describe('revert to unicast', () => {
      let roomSid;
      let aliceRemote;
      let aliceRoom;
      let bobRoom;
      before(async () => {
        const aliceLocalVideo = await waitFor(createLocalVideoTrack(), 'alice local video track');
        const bobLocalVideo = await waitFor(createLocalVideoTrack(), 'bob local video track');
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
      afterEach(() => {
        [aliceRoom, bobRoom].forEach(room => room && room.disconnect());
      });

      it('should fall back to unicast', async () => {
        console.log({ roomSid, aliceRemote, aliceRoom, bobRoom });
        await waitFor(tracksSubscribed(aliceRemote, 1), `Bob to subscribe to Alice's track: ${roomSid}`);
        await waitFor(tracksSubscribed(aliceRemote, 1), `Alice to subscribe to Bob's track: ${roomSid}`);

        await waitForSometime(2000);

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
        expectedSimulcast: true
      },
      {
        testCase: 'does not enable simulcast for H264 rooms',
        roomOptions: { VideoCodecs: ['H264'] },
        expectedCodec: 'H264',
        expectedSimulcast: false
      },
    ].forEach(({ testCase, roomOptions, expectedCodec, expectedSimulcast }) => {
      describe(testCase, () => {
        // eslint-disable-next-line no-invalid-this
        this.timeout(120 * 1000);
        let roomSid = null;
        beforeEach(async () => {
          roomSid = await createRoom(randomName(), defaults.topology, roomOptions);
        });

        it(`uses videoCodec: ${expectedCodec}`, async () => {
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

          const simulcastLayers = await getSimulcastLayerReport(room);
          await waitForSometime(2000);
          const layerArray = Array.from(simulcastLayers.values());
          layerArray.forEach(layer => layer.codec === expectedCodec);
          assert(layerArray.length = expectedSimulcast ? 3 : 1);
        });

        afterEach(() => {
          completeRoom(roomSid);
        });
      });
    });
  }
});

if (defaults.topology !== 'peer-to-peer') {
  describe('adaptive simulcast', function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(120 * 1000);

    let roomSid = null;
    let aliceVideoTrackPublication = null;
    let aliceRemoteVideoForBob = null;
    let aliceRoom = null;
    // let aliceRemoteVideoForCharlie = null;
    const bandwidthProfile = { video: { contentPreferencesMode: 'manual', clientTrackSwitchOffControl: 'manual' } };
    before(async () => {
      roomSid = await createRoom(randomName(), defaults.topology);
    });

    it('When Alice joins the room, all layers get turned off.', async () => {
      const aliceLocalVideo = await waitFor(createLocalVideoTrack(), 'alice local video track');
      aliceRoom = await connect(getToken('Alice'), {
        ...defaults,
        tracks: [aliceLocalVideo],
        name: roomSid,
        loggerName: 'AliceLogger',
        preferredVideoCodecs: 'auto',
        bandwidthProfile
      });

      const activeLayers = await getActiveLayers({ room: aliceRoom });
      console.log(activeLayers);
      // eslint-disable-next-line no-warning-comments
      // TODO(mpatwardhan): enable assertions after VIDEO-7185 is fixed.
      // assert(activeLayers.length === 0);

      aliceVideoTrackPublication = [...aliceRoom.localParticipant.tracks.values()][0];
    });

    describe('After Bob joins the room', () => {
      let bobRoom = null;
      let aliceInBobsRoom = null;
      before(async () => {
        bobRoom = await connect(getToken('Bob'), {
          ...defaults,
          tracks: [],
          name: roomSid,
          loggerName: 'BobLogger',
          preferredVideoCodecs: 'auto',
          bandwidthProfile
        });
        const bobLogger = Logger.getLogger('BobLogger');
        const aliceLogger = Logger.getLogger('AliceLogger');
        bobLogger.setLevel('ERROR');
        aliceLogger.setLevel('WARN');


        await waitFor(participantsConnected(bobRoom, 1), `wait for Bob to see alice: ${roomSid}`);
        aliceInBobsRoom = bobRoom.participants.get(aliceRoom.localParticipant.sid);
        await waitFor(tracksSubscribed(aliceInBobsRoom, 1), `wait for Bob to see alice's track: ${roomSid}`);
        console.log('makarand: bobRoom.videoTracks:', aliceInBobsRoom.videoTracks);
        aliceRemoteVideoForBob = aliceInBobsRoom.videoTracks.get(aliceVideoTrackPublication.trackSid).track;
      });
      [
        {
          testCase: 'c1 bob renders @ 640x360',
          actions: { switchOff: false, switchOn: true, renderDimensions: { width: 640, height: 360 } },
          expectedActiveLayers: 2
        },
        {
          testCase: 'c2 bob switches off',
          actions: { switchOff: true, switchOn: false },
          expectedActiveLayers: 0
        },
        {
          testCase: 'c3 bob switch on and renders @ 1280x720',
          actions: { switchOff: false, switchOn: true, renderDimensions: { width: 1280, height: 720 } },
          expectedActiveLayers: 3
        },
        {
          testCase: 'c4 bob request 640x360',
          actions: { renderDimensions: { width: 640, height: 360 } },
          expectedActiveLayers: 2
        },
        {
          testCase: 'c5 bob request 320x180',
          actions: { renderDimensions: { width: 320, height: 180 } },
          expectedActiveLayers: 1
        },
        {
          testCase: 'c7 bob switches off',
          actions: { switchOff: true },
          expectedActiveLayers: 0
        },
      ].forEach(({ testCase, actions, expectedActiveLayers }) => {
        it(testCase, async () => {
          console.log(`executing ${testCase}`);

          if (actions.switchOn) {
            console.log('switching on');
            aliceRemoteVideoForBob.switchOn();
            await waitFor(trackSwitchedOn(aliceRemoteVideoForBob), `track to switch on: ${aliceRemoteVideoForBob.sid}`);
          }
          if (actions.switchOff) {
            console.log('switching off');
            aliceRemoteVideoForBob.switchOff();
            await waitFor(trackSwitchedOff(aliceRemoteVideoForBob), `track to switch off: ${aliceRemoteVideoForBob.sid}`);
          }
          if (actions.renderDimensions) {
            console.log('setting  renderDimensions', actions.renderDimensions);
            aliceRemoteVideoForBob.setContentPreferences({ renderDimensions: actions.renderDimensions });
          }
          const activeLayers = await getActiveLayers({ room: aliceRoom });
          console.log(`activeLayers ${JSON.stringify(activeLayers)}`);
          assert(activeLayers.length === expectedActiveLayers, `was expecting expectedActiveLayers=${expectedActiveLayers} but found: ${activeLayers.length}`);
        });
      });
    });
  });
}


