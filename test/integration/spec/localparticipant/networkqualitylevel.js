'use strict';

const assert = require('assert');

const {
  connect,
  createLocalTracks
} = require('../../../../es5');

const defaults = require('../../../lib/defaults');
const getToken = require('../../../lib/token');

const {
  combinationContext,
  randomName,
  waitFor,
  waitForNot
} = require('../../../lib/util');

describe('LocalParticipant: networkQualityLevel', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);

  (defaults.topology !== 'peer-to-peer' ? describe : describe.skip)('"networkQualityLevelChanged" event', () => {

    function inRange(num, low, high) {
      return typeof num === 'number' && low <= num && num <= high;
    }

    function verifyNetworkQualityStats(stats, nqLevel, configLevel) {
      switch (configLevel) {
        case 1:
          assert.equal(stats, null);
          break;
        case 2:
          if (nqLevel === 0) {
            assert.equal(stats, null);
            assert.equal(stats, null);
          } else {
            assert.notEqual(stats.audio, null);
            assert.notEqual(stats.video, null);
            assert.equal(stats.audio.sendStats, null);
            assert.equal(stats.video.sendStats, null);
            assert.equal(stats.audio.recvStats, null);
            assert.equal(stats.video.recvStats, null);
          }
          break;
        case 3:
          if (nqLevel === 0) {
            assert.equal(stats, null);
            assert.equal(stats, null);
          } else {
            assert.notEqual(stats.audio, null);
            assert.notEqual(stats.video, null);
            assert.notEqual(stats.audio.sendStats, null);
            assert.notEqual(stats.video.sendStats, null);
            assert.notEqual(stats.audio.recvStats, null);
            assert.notEqual(stats.video.recvStats, null);
          }
      }
    }

    combinationContext([
      [
        [null, 1, 2, 3],
        x => `when local verbosity is ${x || 'default'}`
      ],
      [
        [null, 0, 1, 2, 3],
        x => `when remote verbosity is ${x || 'default'}`
      ]
    ], ([local, remote]) => {
      const options = Object.assign({ name: randomName() }, defaults);
      let thisRoom;
      let thatRoom;
      let localNqLevel;
      let localNqStats;
      let remoteNqLevel;
      let remoteNqStats;

      const nqConfig = (local || remote) ? { local, remote } : true;

      async function setup() {
        const thisTracks = await createLocalTracks({ audio: true, fake: true });
        thisRoom = await connect(getToken(randomName()), Object.assign({ tracks: thisTracks }, options, { networkQuality: nqConfig }));
        const localNqLevelPromise = new Promise(resolve => thisRoom.localParticipant.once('networkQualityLevelChanged', (level, stats) => {
          assert.equal(level, thisRoom.localParticipant.networkQualityLevel);
          assert.deepStrictEqual(stats, thisRoom.localParticipant.networkQualityStats);
          resolve([level, stats]);
        }));
        const remoteNqLevelPromise = inRange(nqConfig.remote, 1, 3)
          ? new Promise(resolve => thisRoom.on('participantConnected',
            participant => participant.once('networkQualityLevelChanged', (level, stats) => {
              assert.equal(level, participant.networkQualityLevel);
              assert.deepStrictEqual(stats, participant.networkQualityStats);
              resolve([level, stats]);
            }))) : Promise.resolve([]);
        const thatTracks = await createLocalTracks({ audio: true, fake: true });
        thatRoom = await connect(getToken(randomName()), Object.assign({ tracks: thatTracks }, options));
        [localNqLevel, localNqStats] = await localNqLevelPromise;
        [remoteNqLevel, remoteNqStats] = await remoteNqLevelPromise;
      }

      before(async () => {
        await setup();
      });

      it('is raised whenever network quality level for the LocalParticipant changes', () => {
        assert.notEqual(localNqLevel, 0);
        verifyNetworkQualityStats(localNqStats, localNqLevel, nqConfig.local);
      });

      if (inRange(nqConfig.remote, 1, 3)) {
        it('is raised whenever network quality level for the RemoteParticipant changes', () => {
          verifyNetworkQualityStats(remoteNqStats, remoteNqLevel, nqConfig.remote);
        });
      }

      after(() => {
        if (thisRoom) {
          thisRoom.disconnect();
        }
        if (thatRoom) {
          thatRoom.disconnect();
        }
      });
    });

    describe('setNetworkQualityConfiguration', () => {
      let thisRoom;
      let thatRoom;

      beforeEach(() => {
        thisRoom = null;
        thatRoom = null;
      });

      afterEach(() => {
        [thisRoom, thatRoom].forEach(room => room && room.disconnect());
      });

      it('when networkConfiguration is false does not fire networkQualityLevelChanged', async () => {
        const nqConfig = false;
        const options = Object.assign({ name: randomName() }, defaults);
        const thisTracks = await createLocalTracks({ audio: true, fake: true });
        thisRoom = await connect(getToken('Alice_Old'), Object.assign({ tracks: thisTracks }, options, { networkQuality: nqConfig }));
        const localNqLevelPromise = new Promise(resolve => thisRoom.localParticipant.once('networkQualityLevelChanged', (level, stats) => {
          assert.equal(level, thisRoom.localParticipant.networkQualityLevel);
          assert.deepStrictEqual(stats, thisRoom.localParticipant.networkQualityStats);
          resolve([level, stats]);
        }));

        const thatTracks = await createLocalTracks({ audio: true, fake: true });
        thatRoom = await connect(getToken('Bob_Old'), Object.assign({ tracks: thatTracks }, options));
        await waitForNot(localNqLevelPromise, 'networkQualityLevelChanged was not expected');
      });

      [
        {
          name: 'case 1',
          initialConfig: { local: 1, remote: 0 },
          updatedConfig: { local: 3, remote: 3 }
        },
        {
          name: 'case 2',
          initialConfig: { local: 3, remote: 3 },
          updatedConfig: { local: 1, remote: 0 }
        }
      ].forEach(testCase => {
        // eslint-disable-next-line no-warning-comments
        // TODO(mmalavalli): Re-enable once JSDK-2827 is implemented.
        it.skip(`setNetworkQualityConfiguration can update the configuration after connect: ${testCase.name}`, async () => {
          let nqConfig = testCase.initialConfig;
          const options = Object.assign({ name: randomName() }, defaults);
          const thisTracks = await createLocalTracks({ audio: true, fake: true });
          thisRoom = await connect(getToken('Alice'), Object.assign({ tracks: thisTracks }, options, { networkQuality: nqConfig }));

          const localNqLevelPromise = new Promise(resolve => thisRoom.localParticipant.once('networkQualityLevelChanged', (level, stats) => {
            assert.equal(level, thisRoom.localParticipant.networkQualityLevel);
            assert.deepStrictEqual(stats, thisRoom.localParticipant.networkQualityStats);
            resolve([level, stats]);
          }));

          const thatTracks = await createLocalTracks({ audio: true, fake: true });
          thatRoom = await connect(getToken('Bob'), Object.assign({ tracks: thatTracks }, options));

          let [localNqLevel, localNqStats] = await waitFor(localNqLevelPromise, 'networkQualityLevelChanged is now expected');
          verifyNetworkQualityStats(localNqStats, localNqLevel, nqConfig.local);

          nqConfig = testCase.updatedConfig;
          thisRoom.localParticipant.setNetworkQualityConfiguration(nqConfig);

          const updatedNqLevelPromise = new Promise(resolve => thisRoom.localParticipant.once('networkQualityLevelChanged', (level, stats) => {
            assert.equal(level, thisRoom.localParticipant.networkQualityLevel);
            assert.deepStrictEqual(stats, thisRoom.localParticipant.networkQualityStats);
            resolve([level, stats]);
          }));

          // we expect that when next networkQualityLevelChanged fires, it will have new stats.
          // but the problem is we get networkQualityLevelChanged only if networkLevel change. And we have no way
          // to force networkQualityLevelChanged. (JSDK-2827)
          [localNqLevel, localNqStats] = await waitFor(updatedNqLevelPromise, 'updated networkQualityLevelChanged is now expected');
          verifyNetworkQualityStats(localNqStats, localNqLevel, nqConfig.local);
        });
      });
    });
  });
});
