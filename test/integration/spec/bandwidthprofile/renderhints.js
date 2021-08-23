/* eslint-disable no-undefined */
'use strict';

const assert = require('assert');
const { video: createLocalVideoTrack } = require('../../../../es5/createlocaltrack');
const defaults = require('../../../lib/defaults');

const {
  tracksSubscribed,
  trackSwitchedOff,
  trackSwitchedOn,
  waitFor,
  setupAliceAndBob,
  assertMediaFlow,
  validateMediaFlow,
  waitForNot
} = require('../../../lib/util');

const { trackPriority: { PRIORITY_STANDARD } } = require('../../../../es5/util/constants');
const { waitForSometime } = require('../../../../es5/util');

describe('BandwidthProfileOptions: renderHints', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(120 * 1000);
  // eslint-disable-next-line no-invalid-this
  // this.retries(2);

  if (defaults.topology === 'peer-to-peer') {
    it('should not run', () => {});
    return;
  }

  describe('renderHints', () => {
    [
      {
        testCase: 'when clientTrackSwitchOffControl=manual',
        bandwidthProfile: {
          video: {
            clientTrackSwitchOffControl: 'manual'
          }
        },
        effectiveClientTrackSwitchOffControl: 'manual',
        effectiveContentPreferencesMode: 'auto',
      },
      {
        testCase: 'when clientTrackSwitchOffControl=auto',
        bandwidthProfile: {
          video: {
            clientTrackSwitchOffControl: 'auto'
          }
        },
        effectiveClientTrackSwitchOffControl: 'auto',
        effectiveContentPreferencesMode: 'auto',
      },
      {
        testCase: 'when clientTrackSwitchOffControl=unspecified',
        bandwidthProfile: {
          video: {
          }
        },
        effectiveClientTrackSwitchOffControl: 'auto',
        effectiveContentPreferencesMode: 'auto',
      },
      {
        testCase: 'when clientTrackSwitchOffControl=unspecified, maxTracks=5',
        bandwidthProfile: {
          video: {
            maxTracks: 5,
          }
        },
        effectiveClientTrackSwitchOffControl: 'disabled', // when maxTracks is specified, effectiveClientTrackSwitchOffControl should be disabled.
        effectiveContentPreferencesMode: 'auto',
      },
      {
        testCase: 'when contentPreferencesMode=manual',
        bandwidthProfile: {
          video: {
            contentPreferencesMode: 'manual'
          }
        },
        effectiveClientTrackSwitchOffControl: 'auto',
        effectiveContentPreferencesMode: 'manual',
      },
      {
        testCase: 'when contentPreferencesMode=unspecified',
        bandwidthProfile: {
          video: {
          }
        },
        effectiveClientTrackSwitchOffControl: 'auto',
        effectiveContentPreferencesMode: 'auto',
      },
      {
        testCase: 'contentPreferencesMode=unspecified, renderDimensions=specified',
        bandwidthProfile: {
          video: {
            renderDimensions: {
              low: { width: 100, height: 100 }
            }
          }
        },
        effectiveClientTrackSwitchOffControl: 'auto',
        effectiveContentPreferencesMode: 'disabled',
      }
    ].forEach(({ testCase, bandwidthProfile, effectiveClientTrackSwitchOffControl,  effectiveContentPreferencesMode }) => {
      let aliceRoom;
      let bobRoom;
      let roomSid;
      let aliceRemote;
      let aliceRemoteTrack;
      let videoElement1;
      let videoElement2;
      context(testCase, () => {
        before(async () => {
          const aliceLocalVideo = await waitFor(createLocalVideoTrack(), 'alice local video track');
          const aliceOptions = { tracks: [aliceLocalVideo] };
          const bobOptions = { tracks: [], bandwidthProfile };

          ({ roomSid, aliceRemote, aliceRoom, bobRoom } = await setupAliceAndBob({ aliceOptions,  bobOptions }));
          await waitFor(tracksSubscribed(aliceRemote, 1), `Bob to subscribe to Alice's track: ${roomSid}`);
          aliceRemoteTrack = Array.from(aliceRemote.videoTracks.values())[0].track;
        });

        after(() => {
          [aliceRoom, bobRoom].forEach(room => room.disconnect());
        });

        it('sets correct render hint options for RemoteVideoTracks', () => {
          assert(aliceRemoteTrack._clientTrackSwitchOffControl === effectiveClientTrackSwitchOffControl);
          assert(aliceRemoteTrack._contentPreferencesMode === effectiveContentPreferencesMode);
        });

        if (effectiveClientTrackSwitchOffControl === 'manual') {
          it('switchOn/switchOff can be used to turn tracks on/off', async () => {
            // initially track should be switched on
            await waitFor(trackSwitchedOn(aliceRemoteTrack), `Alice's Track [${aliceRemoteTrack.sid}] to switch on: ${roomSid}`);
            assert.strictEqual(aliceRemoteTrack.isSwitchedOff, false, `Alice's Track.isSwitchedOff = ${aliceRemoteTrack.isSwitchedOff}`);
            await assertMediaFlow(bobRoom, true, `was expecting media flow: ${roomSid}`);

            aliceRemoteTrack.switchOff();
            await waitFor(trackSwitchedOff(aliceRemoteTrack), `Alice's Track [${aliceRemoteTrack.sid}] to switch off: ${roomSid}`);
            assert.strictEqual(aliceRemoteTrack.isSwitchedOff, true, `Alice's Track.isSwitchedOff = ${aliceRemoteTrack.isSwitchedOff}`);
            await assertMediaFlow(bobRoom, false, `was not expecting media flow: ${roomSid}`);

            aliceRemoteTrack.switchOn();
            await waitFor(trackSwitchedOn(aliceRemoteTrack), `Alice's Track [${aliceRemoteTrack.sid}] to switch on: ${roomSid}`);
            assert.strictEqual(aliceRemoteTrack.isSwitchedOff, false, `Alice's Track.isSwitchedOff = ${aliceRemoteTrack.isSwitchedOff}`);
            await assertMediaFlow(bobRoom, true, `was expecting media flow: ${roomSid}`);
          });
        } else {
          it('switchOff/switchOn methods throw an error', () => {
            let switchOffError = false;
            let switchOnError = false;
            try {
              aliceRemoteTrack.switchOff();
            } catch (_e) {
              switchOffError = true;
            }

            try {
              aliceRemoteTrack.switchOn();
            } catch (_e) {
              switchOnError = true;
            }

            assert(switchOnError && switchOffError);
          });
        }

        if (effectiveClientTrackSwitchOffControl === 'auto') {
          it('Track turns off if video element is not attached initially', async () => {
            // since no video elements are attached. Tracks should switch off initially
            await waitFor(trackSwitchedOff(aliceRemoteTrack), `Alice's Track [${aliceRemoteTrack.sid}] to switch off: ${roomSid}`);
            assert.strictEqual(aliceRemoteTrack.isSwitchedOff, true, `Alice's Track.isSwitchedOff = ${aliceRemoteTrack.isSwitchedOff}`);
            await assertMediaFlow(bobRoom, false, `was not expecting media flow: ${roomSid}`);
          });

          it('Track turns on when a video element is attached', async () => {
            videoElement1 = aliceRemoteTrack.attach();
            document.body.appendChild(videoElement1);
            await waitFor(trackSwitchedOn(aliceRemoteTrack), `Alice's Track [${aliceRemoteTrack.sid}] to switch on: ${roomSid}`);
            assert.strictEqual(aliceRemoteTrack.isSwitchedOff, false, `Alice's Track.isSwitchedOff = ${aliceRemoteTrack.isSwitchedOff}`);
            await assertMediaFlow(bobRoom, true, `was expecting media flow: ${roomSid}`);
          });

          it('Track stays on when another video element is attached', async () => {
            videoElement2 = aliceRemoteTrack.attach();
            document.body.appendChild(videoElement2);
            await waitFor(trackSwitchedOn(aliceRemoteTrack), `Alice's Track [${aliceRemoteTrack.sid}] to switch on: ${roomSid}`);
            assert.strictEqual(aliceRemoteTrack.isSwitchedOff, false, `Alice's Track.isSwitchedOff = ${aliceRemoteTrack.isSwitchedOff}`);
            await assertMediaFlow(bobRoom, true, `was expecting media flow: ${roomSid}`);
          });

          it('tracks stays on when one of the video element is detached ', async () => {
            aliceRemoteTrack.detach(videoElement2);
            videoElement2.remove();
            await waitFor(trackSwitchedOn(aliceRemoteTrack), `Alice's Track [${aliceRemoteTrack.sid}] to switch on: ${roomSid}`);
            assert.strictEqual(aliceRemoteTrack.isSwitchedOff, false, `Alice's Track.isSwitchedOff = ${aliceRemoteTrack.isSwitchedOff}`);
            await assertMediaFlow(bobRoom, true, `was expecting media flow: ${roomSid}`);
          });

          it('tracks does not turns off if video element is detached and attached quickly ', async () => {
            const aliceTrackSwitchOffPromise = trackSwitchedOff(aliceRemoteTrack);
            aliceRemoteTrack.detach(videoElement2);
            await waitForSometime(10);
            aliceRemoteTrack.attach(videoElement2);
            await waitForNot(aliceTrackSwitchOffPromise, `Alice's Track [${aliceRemoteTrack.sid}] to not switch off: ${roomSid}`);
          });

          it('tracks turns off when all video elements are detached ', async () => {
            const elements = aliceRemoteTrack.detach();
            elements.forEach(el => el.remove());
            await waitFor(trackSwitchedOff(aliceRemoteTrack), `Alice's Track [${aliceRemoteTrack.sid}] to switch off: ${roomSid}`);
            assert.strictEqual(aliceRemoteTrack.isSwitchedOff, true, `Alice's Track.isSwitchedOff = ${aliceRemoteTrack.isSwitchedOff}`);
            await assertMediaFlow(bobRoom, false, `was not expecting media flow: ${roomSid}`);
          });
        } else {
          it('Track turns on even if video element is not attached initially', async () => {
            // since no video elements are attached. Tracks should switch off initially
            await waitForNot(trackSwitchedOff(aliceRemoteTrack), `Alice's Track [${aliceRemoteTrack.sid}] to not switch off: ${roomSid}`);
            assert.strictEqual(aliceRemoteTrack.isSwitchedOff, false, `Alice's Track.isSwitchedOff = ${aliceRemoteTrack.isSwitchedOff}`);
            await assertMediaFlow(bobRoom, true, `was expecting media flow: ${roomSid}`);
          });
        }

        if (effectiveContentPreferencesMode === 'manual') {
          it('setContentPreference does not throw', () => {
            try {
              aliceRemoteTrack.setContentPreferences({ renderDimensions: { width: 100, height: 100 } });
            } catch (e) {
              assert(false, 'was not expecting setContentPreferences to throw: ' + e);
            }
          });
        } else {
          it('setContentPreference throws', () => {
            let errorThrown = false;
            try {
              aliceRemoteTrack.setContentPreferences({ renderDimensions: { width: 100, height: 100 } });
            } catch (_e) {
              errorThrown = true;
            }
            assert(errorThrown);
          });
        }
      });
    });

    [
      {
        dimA: { width: 50, height: 40 },
        dimB: { width: 1024, height: 720 },
        expectBandwidthUsageIncrease: true
      },
      {
        dimA: { width: 1024, height: 720 },
        dimB: { width: 50, height: 40 },
        expectBandwidthUsageIncrease: false
      }
    ].forEach(({ dimA, dimB, expectBandwidthUsageIncrease }) => {
      it(`video dimension ${dimA.width}x${dimA.height} => ${dimB.width}x${dimB.height} ${expectBandwidthUsageIncrease ? 'increases' : 'decreases'} bandwidth usage`, async () => {
        const aliceLocalVideo = await waitFor(createLocalVideoTrack(), 'alice local video track');
        const aliceOptions = { tracks: [aliceLocalVideo] };
        const bobOptions = {
          tracks: [],
          bandwidthProfile: {
            video: {
              contentPreferencesMode: 'auto',
              dominantSpeakerPriority: PRIORITY_STANDARD
            }
          },
        };

        const { roomSid, aliceRoom, bobRoom, aliceRemote } = await setupAliceAndBob({ aliceOptions,  bobOptions });
        await waitFor(tracksSubscribed(aliceRemote, 1), `Bob to subscribe to Alice's track: ${roomSid}`);
        const aliceRemoteTrack = Array.from(aliceRemote.videoTracks.values())[0].track;

        const videoElement = aliceRemoteTrack.attach();
        document.body.appendChild(videoElement);

        // track should switch on
        await waitFor(trackSwitchedOn(aliceRemoteTrack), `Alice's Track [${aliceRemoteTrack.sid}] to switch on: ${roomSid}`);
        videoElement.setAttribute('height', `${dimA.height}`);
        videoElement.setAttribute('width', `${dimA.width}`);

        // wait couple of seconds before running media flow test.
        await waitForSometime(2000);

        const duration = 15000;
        let { bytesReceivedBefore, bytesReceivedAfter } = await validateMediaFlow(bobRoom, duration, ['remoteVideoTrackStats']);
        const bytesReceivedA = bytesReceivedAfter - bytesReceivedBefore;

        videoElement.setAttribute('height', `${dimB.height}`);
        videoElement.setAttribute('width', `${dimB.width}`);

        // wait couple of seconds before running media flow test.
        await waitForSometime(2000);

        ({ bytesReceivedBefore, bytesReceivedAfter } = await validateMediaFlow(bobRoom, duration, ['remoteVideoTrackStats']));
        const bytesReceivedB = bytesReceivedAfter - bytesReceivedBefore;

        aliceRemoteTrack.detach(videoElement);
        videoElement.remove();

        if (expectBandwidthUsageIncrease) {
          assert(bytesReceivedB > bytesReceivedA, `was expecting bandwidth usage to increase: ${bytesReceivedA} => ${bytesReceivedB}`);
        } else {
          assert(bytesReceivedB < bytesReceivedA, `was expecting bandwidth usage to decrease: ${bytesReceivedA} => ${bytesReceivedB}`);
        }

        [aliceRoom, bobRoom].forEach(room => room.disconnect());
      });
    });

    it('manually switched offs tracks should not get turned on by auto events', async () => {
      const aliceLocalVideo = await waitFor(createLocalVideoTrack(), 'alice local video track');
      const aliceOptions = { tracks: [aliceLocalVideo] };
      const bobOptions = {
        tracks: [],
        bandwidthProfile: {
          video: {
            clientTrackSwitchOffControl: 'manual',
            contentPreferencesMode: 'auto'
          }
        }
      };

      const { roomSid, aliceRemote, aliceRoom, bobRoom } = await setupAliceAndBob({ aliceOptions,  bobOptions });
      await waitFor(tracksSubscribed(aliceRemote, 1), `Bob to subscribe to Alice's track: ${roomSid}`);
      const aliceRemoteTrack = Array.from(aliceRemote.videoTracks.values())[0].track;

      // track should be switched On initially.
      await waitFor(trackSwitchedOn(aliceRemoteTrack), `Alice's Track [${aliceRemoteTrack.sid}] to switch On: ${roomSid}`);
      aliceRemoteTrack.switchOff();

      // wait for track to switch off
      await waitFor(trackSwitchedOff(aliceRemoteTrack), `Alice's Track [${aliceRemoteTrack.sid}] to switch Off: ${roomSid}`);

      let trackSwitchOnPromise = trackSwitchedOn(aliceRemoteTrack);

      // attach element
      const videoElement1 = aliceRemoteTrack.attach();
      document.body.appendChild(videoElement1);
      await waitForSometime(1000);

      // resize element.
      videoElement1.setAttribute('height', '100');
      videoElement1.setAttribute('width', '100');
      await waitForSometime(1000);

      // detach element
      aliceRemoteTrack.detach(videoElement1);
      await waitForSometime(1000);

      // none of above should cause track to switch on.
      await waitForNot(trackSwitchOnPromise, `Alice's Track [${aliceRemoteTrack.sid}] to switch On unexpectedly: ${roomSid}`);
      [aliceRoom, bobRoom].forEach(room => room.disconnect());
    });
  });
});

