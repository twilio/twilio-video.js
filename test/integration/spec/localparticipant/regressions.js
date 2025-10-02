'use strict';

const assert = require('assert');

const {
  connect,
  createLocalAudioTrack,
  createLocalTracks,
  createLocalVideoTrack,
  LocalDataTrack
} = require('../../../../es5');

const RemoteAudioTrackPublication = require('../../../../es5/media/track/remoteaudiotrackpublication');
const RemoteDataTrackPublication = require('../../../../es5/media/track/remotedatatrackpublication');
const RemoteVideoTrackPublication = require('../../../../es5/media/track/remotevideotrackpublication');
const { flatMap } = require('../../../../es5/util');
const { getMediaSections } = require('../../../../es5/util/sdp');

const defaults = require('../../../lib/defaults');
const { isChrome, isFirefox } = require('../../../lib/guessbrowser');
const { createRoom, completeRoom } = require('../../../lib/rest');
const getToken = require('../../../lib/token');

const {
  capitalize,
  combinationContext,
  isRTCRtpSenderParamsSupported,
  participantsConnected,
  randomName,
  smallVideoConstraints,
  tracksSubscribed,
  trackStarted,
  waitForTracks
} = require('../../../lib/util');

describe('LocalParticipant: regressions', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);

  // NOTE(mroberts): The following test reproduces the issue described in
  //
  //   https://github.com/twilio/twilio-video.js/issues/72
  //
  describe('#unpublishTrack and #publishTrack called with two different LocalVideoTracks in quick succession', () => {
    let sid;
    let thisRoom;
    let thisParticipant;
    let thisLocalTrackPublication1;
    let thisLocalTrackPublication2;
    let thisTrack1;
    let thisTrack2;
    let thatRoom;
    let thatParticipant;
    let thatTrackUnpublished;
    let thatTrackUnsubscribed;
    let thatTrackSubscribed;
    let thatTrackPublished;
    let thatTracksPublished;
    let thatTracksUnpublished;

    before(async () => {
      sid = await createRoom(randomName(), defaults.topology);
      const constraints = { video: smallVideoConstraints, fake: true };

      // Answerer
      const thoseOptions = Object.assign({ name: sid, tracks: [] }, defaults);
      thatRoom = await connect(getToken(randomName()), thoseOptions);

      [thisTrack1] = await createLocalTracks(constraints);

      // Offerer
      const theseOptions = Object.assign({ name: sid, tracks: [thisTrack1] }, defaults);
      thisRoom = await connect(getToken(randomName()), theseOptions);
      thisParticipant = thisRoom.localParticipant;

      await Promise.all([thisRoom, thatRoom].map(room => participantsConnected(room, 1)));
      thatParticipant = thatRoom.participants.get(thisParticipant.sid);
      assert(thatParticipant);

      await tracksSubscribed(thatParticipant, thisParticipant._tracks.size);

      // NOTE(mroberts): Wait 5 seconds.
      await new Promise(resolve => setTimeout(resolve, 5 * 1000));

      const trackUnpublishedPromise = new Promise(resolve => thatParticipant.once('trackUnpublished', resolve));
      const trackUnsubscribedPromise = new Promise(resolve => thatParticipant.once('trackUnsubscribed', resolve));
      const trackPublishedPromise = new Promise(resolve => thatParticipant.once('trackPublished', resolve));
      const trackSubscribedPromise = new Promise(resolve => thatParticipant.once('trackSubscribed', resolve));

      thisLocalTrackPublication1 = thisParticipant.unpublishTrack(thisTrack1);
      [thisTrack2] = await createLocalTracks(constraints);

      [thatTrackUnpublished, thatTrackUnsubscribed, thatTrackPublished, thatTrackSubscribed, thisLocalTrackPublication2] = await Promise.all([
        trackUnpublishedPromise,
        trackUnsubscribedPromise,
        trackPublishedPromise,
        trackSubscribedPromise,
        thisParticipant.publishTrack(thisTrack2)
      ]);

      thatTracksPublished = {
        trackPublished: thatTrackPublished,
        trackSubscribed: thatTrackSubscribed
      };

      thatTracksUnpublished = {
        trackUnpublished: thatTrackUnpublished,
        trackUnsubscribed: thatTrackUnsubscribed
      };
    });

    after(async () => {
      thisTrack1.stop();
      thisTrack2.stop();
      [thisRoom, thatRoom].forEach(room => room && room.disconnect());
      if (sid) {
        await completeRoom(sid);
      }
    });

    it('should eventually raise a "trackUnpublished" event for the unpublished LocalVideoTrack', () => {
      const thatTrackPublication = thatTracksUnpublished.trackUnpublished;
      assert(thatTrackPublication instanceof RemoteVideoTrackPublication);
      ['isTrackEnabled', 'kind', 'trackName', 'trackSid'].forEach(prop => {
        assert.equal(thatTrackPublication[prop], thisLocalTrackPublication1[prop]);
      });
    });

    it('should eventually raise a "trackPublished" event for the published LocalVideoTrack', () => {
      const thatTrackPublication = thatTracksPublished.trackPublished;
      assert(thatTrackPublication instanceof RemoteVideoTrackPublication);
      ['isTrackEnabled', 'kind', 'trackName', 'trackSid'].forEach(prop => {
        assert.equal(thatTrackPublication[prop], thisLocalTrackPublication2[prop]);
      });
    });

    it('should eventually raise a "trackUnsubscribed" event for the unpublished LocalVideoTrack', () => {
      const thatTrack = thatTracksUnpublished.trackUnsubscribed;
      assert.equal(thatTrack.sid, thisLocalTrackPublication1.trackSid);
      assert.equal(thatTrack.kind, thisLocalTrackPublication1.kind);
      assert.equal(thatTrack.enabled, thisLocalTrackPublication1.enabled);
    });

    it('should eventually raise a "trackSubscribed" event for the published LocalVideoTrack', () => {
      const thatTrack = thatTracksPublished.trackSubscribed;
      assert.equal(thatTrack.sid, thisLocalTrackPublication2.trackSid);
      assert.equal(thatTrack.kind, thisLocalTrackPublication2.kind);
      assert.equal(thatTrack.enabled, thisLocalTrackPublication2.enabled);
      assert.equal(thatTrack.mediaStreamTrack.readyState, thisTrack2.mediaStreamTrack.readyState);
    });

    it('should eventually raise a "trackStarted" event for the published LocalVideoTrack', async () => {
      if (isFirefox /* && isGroupRoom */) {
        return;
      }
      await trackStarted(thatTrackSubscribed);
    });
  });

  describe('#publishTrack called twice in quick succession', () => {
    function kindCombination(contextPrefix) {
      return [
        [
          {
            createLocalTrack: () => createLocalAudioTrack({ fake: true }),
            kind: 'audio',
            RemoteTrackPublication: RemoteAudioTrackPublication
          },
          {
            createLocalTrack: () => new LocalDataTrack(),
            kind: 'data',
            RemoteTrackPublication: RemoteDataTrackPublication
          },
          {
            createLocalTrack: () => createLocalVideoTrack(smallVideoConstraints),
            kind: 'video',
            RemoteTrackPublication: RemoteVideoTrackPublication
          }
        ],
        ({ kind }) => `${contextPrefix} a Local${capitalize(kind)}Track`
      ];
    }

    combinationContext(['with', 'and'].map(kindCombination), ([kindCombination1, kindCombination2]) => {
      const createLocalTrack1 = kindCombination1.createLocalTrack;
      const createLocalTrack2 = kindCombination2.createLocalTrack;
      const kind1 = kindCombination1.kind;
      const kind2 = kindCombination2.kind;
      const RemoteTrackPublication1 = kindCombination1.RemoteTrackPublication;
      const RemoteTrackPublication2 = kindCombination2.RemoteTrackPublication;

      let sid;
      let thisRoom;
      let thisParticipant;
      let thisLocalTrack1;
      let thisLocalTrack2;
      let thisLocalTrackPublication1;
      let thisLocalTrackPublication2;
      let thatRoom;
      let thatParticipant;
      let thoseTracks1;
      let thoseTracks2;

      before(async () => {
        sid = await createRoom(randomName(), defaults.topology);

        // Answerer
        const thoseOptions = Object.assign({ name: sid, tracks: [] }, defaults);
        thatRoom = await connect(getToken(randomName()), thoseOptions);

        [thisLocalTrack1, thisLocalTrack2] = [
          await createLocalTrack1(),
          await createLocalTrack2()
        ];

        // Offerer
        const theseOptions = Object.assign({ name: sid, tracks: [] }, defaults);
        thisRoom = await connect(getToken(randomName()), theseOptions);
        thisParticipant = thisRoom.localParticipant;

        await Promise.all([thisRoom, thatRoom].map(room => participantsConnected(room, 1)));
        thatParticipant = thatRoom.participants.get(thisParticipant.sid);
        assert(thatParticipant);

        // NOTE(mroberts): Wait 5 seconds.
        await new Promise(resolve => setTimeout(resolve, 5 * 1000));

        let thoseTracksPublished;
        let thoseTracksSubscribed;
        [thisLocalTrackPublication1, thisLocalTrackPublication2, thoseTracksPublished, thoseTracksSubscribed] =  await Promise.all([
          thisParticipant.publishTrack(thisLocalTrack1),
          thisParticipant.publishTrack(thisLocalTrack2),
          waitForTracks('trackPublished', thatParticipant, 2),
          waitForTracks('trackSubscribed', thatParticipant, 2)
        ]);

        function findTrackOrPublication(tracksOrPublications, trackSid1) {
          return tracksOrPublications.find(({ sid, trackSid }) => sid === trackSid1 || trackSid === trackSid1);
        }

        thoseTracks1 = {
          trackPublished: findTrackOrPublication(thoseTracksPublished, thisLocalTrackPublication1.trackSid),
          trackSubscribed: findTrackOrPublication(thoseTracksSubscribed, thisLocalTrackPublication1.trackSid)
        };

        thoseTracks2 = {
          trackPublished: findTrackOrPublication(thoseTracksPublished, thisLocalTrackPublication2.trackSid),
          trackSubscribed: findTrackOrPublication(thoseTracksSubscribed, thisLocalTrackPublication2.trackSid)
        };
      });

      after(async () => {
        [thisLocalTrack1, thisLocalTrack2].forEach(track => track.stop && track.stop());
        [thisRoom, thatRoom].forEach(room => room && room.disconnect());
        if (sid) {
          await completeRoom(sid);
        }
      });

      it(`should eventually raise "trackPublished" event for the published Local${capitalize(kind1)}Track and Local${capitalize(kind2)}Track`, () => {
        [
          [thisLocalTrackPublication1, thoseTracks1, RemoteTrackPublication1],
          [thisLocalTrackPublication2, thoseTracks2, RemoteTrackPublication2]
        ].forEach(([thisLocalTrackPublication, thoseTracks, RemoteTrackPublication]) => {
          const thatTrackPublication = thoseTracks.trackPublished;
          assert(thatTrackPublication instanceof RemoteTrackPublication);
          ['isTrackEnabled', 'kind', 'trackName', 'trackSid'].forEach(prop => {
            assert.equal(thatTrackPublication[prop], thisLocalTrackPublication[prop]);
          });
        });
      });

      it(`should eventually raise a "trackSubscribed" event for the published Local${capitalize(kind1)}Track and Local${capitalize(kind2)}Track`, () => {
        [
          [kind1, thisLocalTrack1, thisLocalTrackPublication1, thoseTracks1],
          [kind2, thisLocalTrack2, thisLocalTrackPublication2, thoseTracks2]
        ].forEach(([kind, thisLocalTrack, thisLocalTrackPublication, thoseTracks]) => {
          const thatTrack = thoseTracks.trackSubscribed;
          assert.equal(thatTrack.sid, thisLocalTrackPublication.trackSid);
          assert.equal(thatTrack.kind, thisLocalTrackPublication.kind);
          assert.equal(thatTrack.enabled, thisLocalTrackPublication.enabled);
          if (kind !== 'data') {
            assert.equal(thatTrack.mediaStreamTrack.readyState, thisLocalTrack.mediaStreamTrack.readyState);
          }
        });
      });

      const nonDataKinds = [kind1, kind2].filter(kind => kind !== 'data');
      if (nonDataKinds.length > 0) {
        it(`eventually raise a "trackStarted" event for the published ${nonDataKinds.map(kind => `Local${capitalize(kind)}Track`).join(' and ')}`, async () => {
          const thatTrack1 = thoseTracks1.trackSubscribed;
          const thatTrack2 = thoseTracks2.trackSubscribed;
          await Promise.all([thatTrack1, thatTrack2].filter(({ kind }) => kind !== 'data').map(trackStarted));
        });
      }
    });
  });

  describe('#setParameters', () => {
    const initialEncodingParameters = {
      maxAudioBitrate: 20000,
      maxVideoBitrate: 40000
    };

    combinationContext([
      [
        // eslint-disable-next-line no-undefined
        [undefined, null, 25000, 0],
        x => `when .maxAudioBitrate is ${typeof x === 'undefined' ? 'absent' : x}`
      ],
      [
        // eslint-disable-next-line no-undefined
        [undefined, null, 45000, 0],
        x => `when .maxVideoBitrate is ${typeof x === 'undefined' ? 'absent' : x}`
      ]
    ], ([maxAudioBitrate, maxVideoBitrate]) => {
      const encodingParameters = [
        ['maxAudioBitrate', maxAudioBitrate],
        ['maxVideoBitrate', maxVideoBitrate]
      ].reduce((params, [prop, value]) => {
        if (typeof value !== 'undefined') {
          params[prop] = value;
        }
        return params;
      }, {});

      const maxBitrates = {
        audio: encodingParameters.maxAudioBitrate,
        video: encodingParameters.maxVideoBitrate
      };

      let peerConnections;
      let remoteDescriptions;
      let sid;
      let senders;
      let thisRoom;
      let thoseRooms;

      before(async () => {
        sid = await createRoom(randomName(), defaults.topology);
        const options = Object.assign({
          audio: true,
          name: sid,
          video: smallVideoConstraints
        }, initialEncodingParameters, defaults);
        const token = getToken(randomName());
        thisRoom = await connect(token, options);

        const thoseOptions = Object.assign({ name: options.name, tracks: [] }, defaults);
        const thoseTokens = [randomName(), randomName()].map(getToken);
        thoseRooms = await Promise.all(thoseTokens.map(token => connect(token, thoseOptions)));

        await participantsConnected(thisRoom, thoseRooms.length);
        // NOTE(mroberts): We're waiting on these events because they should
        // indicate that one or more RTCPeerConnections is established.
        await Promise.all(thoseRooms.map(thatRoom => {
          const thisParticipant = thatRoom.participants.get(thisRoom.localParticipant.sid);
          return tracksSubscribed(thisParticipant, thisRoom.localParticipant.tracks.size);
        }));
        peerConnections = [...thisRoom._signaling._peerConnectionManager._peerConnections.values()].map(pcv2 => pcv2._peerConnection);
        thisRoom.localParticipant.setParameters(encodingParameters);

        if (isRTCRtpSenderParamsSupported) {
          // NOTE(mmalavalli): If applying bandwidth constraints using RTCRtpSender.setParameters(),
          // which is an asynchronous operation, wait for a little while until the changes are applied.
          await new Promise(resolve => setTimeout(resolve, 5000));
          senders = flatMap(peerConnections, pc => pc.getSenders().filter(sender => sender.track));
          return;
        }

        function getRemoteDescription(pc) {
          return Object.keys(encodingParameters).length > 0
            ? new Promise(resolve => {
              const pcSetRemoteDescription = pc.setRemoteDescription;
              pc.setRemoteDescription = function setRemoteDescription(description) {
                resolve(description);
                pc.setRemoteDescription = pcSetRemoteDescription;
                return pcSetRemoteDescription.call(this, description);
              };
            })
            : Promise.resolve(pc.remoteDescription);
        }

        remoteDescriptions = await Promise.all(peerConnections.map(getRemoteDescription));
      });

      ['audio', 'video'].forEach(kind => {
        const action = typeof maxBitrates[kind] === 'undefined'
          ? 'preserve'
          : maxBitrates[kind]
            ? 'set'
            : 'remove';
        const newOrExisting = maxBitrates[kind]
          ? 'new'
          : 'existing';

        it(`should ${action} the ${newOrExisting} .max${capitalize(kind)}Bitrate`, () => {
          if (isRTCRtpSenderParamsSupported) {
            senders.filter(({ track }) => track.kind === kind).forEach(sender => {
              const { encodings } = sender.getParameters();
              if (action === 'preserve') {
                encodings.forEach(({ maxBitrate }) => assert.equal(maxBitrate, initialEncodingParameters[`max${capitalize(kind)}Bitrate`]));
              } else if (action === 'set') {
                encodings.forEach(({ maxBitrate }) => assert.equal(maxBitrate, maxBitrates[kind]));
              } else {
                encodings.forEach(encoding => assert.equal('maxBitrate' in encoding, false));
              }
            });
            return;
          }

          flatMap(remoteDescriptions, description => {
            return getMediaSections(description.sdp, kind, '(recvonly|sendrecv)');
          }).forEach(section => {
            const modifier = isFirefox
              ? 'TIAS'
              : 'AS';

            let maxBitrate = action === 'preserve'
              ? initialEncodingParameters[`max${capitalize(kind)}Bitrate`]
              : maxBitrates[kind];

            maxBitrate = maxBitrate
              ? isFirefox
                ? maxBitrate
                : Math.round((maxBitrate + 16000) / 950)
              : null;

            const bLinePattern = maxBitrate
              ? new RegExp(`\r\nb=${modifier}:${maxBitrate}`)
              : /\r\nb=(AS|TIAS)/;

            assert(maxBitrate ? bLinePattern.test(section) : !bLinePattern.test(section));
          });
        });
      });

      after(async () => {
        [thisRoom, ...thoseRooms].forEach(room => room && room.disconnect());
        if (sid) {
          await completeRoom(sid);
        }
      });
    });
  });

  // NOTE (mmalavalli): This test ensures that the behavior described in
  // https://issues.corp.twilio.com/browse/JSDK-2212 is not observed.
  describe('JSDK-2212', () => {
    [
      ['disabled', 'disable'],
      ['enabled', 'enable'],
      ['stopped', 'stop']
    ].forEach(([event, action]) => {
      context(`when a LocalTrack is unpublished in a "${event}" event listener`, () => {
        context('when the listener is added to the LocalTrack before publishing it to the Room', () => {
          it('should not throw', async () => {
            let room;
            const track = await createLocalAudioTrack();
            if (event === 'enabled') {
              track.disable();
            }
            track.once(event, () => {
              room.localParticipant.unpublishTrack(track);
            });
            room = await connect(getToken('foo'), Object.assign({
              name: randomName(),
              tracks: [track]
            }, defaults));
            assert.doesNotThrow(() => track[action]());
          });
        });
      });
    });
  });

  (defaults.topology === 'peer-to-peer' ? describe.skip : describe)('JSDK-2534', () => {
    let localVideoTrackPublications;
    let localVideoTracks;
    let room;
    let sid;

    before(async () => {
      sid = await createRoom(randomName(), defaults.topology);
      localVideoTracks = await Promise.all([
        createLocalVideoTrack(smallVideoConstraints),
        createLocalVideoTrack(smallVideoConstraints)
      ]);

      // Step 1: Connect to a Room with a LocalAudioTrack.
      const options = Object.assign({ audio: true, fake: true, name: sid }, defaults);
      const token = getToken(randomName());
      room = await connect(token, options);

      // Step 2: Try to publish two LocalVideoTracks.
      // The bug is reproducible if this promise never resolves.
      localVideoTrackPublications = await Promise.all(localVideoTracks.map(track => room.localParticipant.publishTrack(track)));
    });

    it('should be fixed', () => {
      assert.equal(localVideoTrackPublications.length, localVideoTracks.length);
    });

    after(async () => {
      if (Array.isArray(localVideoTracks)) {
        localVideoTracks.forEach(track => track.stop());
      }
      if (room) {
        room.disconnect();
      }
      if (sid) {
        await completeRoom(sid);
      }
    });
  });

  describe('JSDK-2769 - #publishTrack and #unpublishTrack, when called in rapid succession', () => {
    let error;
    let publication;

    before(async () => {
      const audioTrack = await createLocalAudioTrack();
      const name = randomName();
      const tracks = [audioTrack, await createLocalVideoTrack()];
      let videoTrack;

      const rooms = await Promise.all([randomName(), randomName()].map(getToken).map((token, i) => connect(token, Object.assign({
        name,
        tracks: i === 0 ? [audioTrack] : tracks
      }, defaults))));

      await Promise.all(rooms.map(room => participantsConnected(room, 1)));

      try {
        for (let i = 0; i < 10; i++) {
          // eslint-disable-next-line no-await-in-loop
          videoTrack = await createLocalVideoTrack();
          // eslint-disable-next-line no-await-in-loop
          publication = await rooms[0].localParticipant.publishTrack(videoTrack);
          videoTrack.stop();
          rooms[0].localParticipant.unpublishTrack(videoTrack);
        }
      } catch (e) {
        error = e;
      }
    });

    it('should complete without any error', () => {
      assert(publication);
      assert(!error);
    });
  });

  describe('JSDK-2985 - Clean up LocalTrack event listeners added by the LocalTrackPublication after leaving room', () => {
    let room;
    let error;
    let listenerCount = 0;
    let localAudioTrack;
    const events = ['enabled', 'disabled', 'started', 'stopped', 'message'];
    async function setupRoom(token, options) {
      let room = await connect(token, options);
      return room;
    }

    before(async () => {
      try {
        localAudioTrack = await createLocalAudioTrack({ fake: true });
        const token = getToken(randomName());
        const options = Object.assign({ tracks: [localAudioTrack] }, defaults);
        // eslint-disable-next-line no-await-in-loop
        room = await setupRoom(token, options);
        if (room) {
          room.disconnect();
        }
        events.forEach(event => {
          listenerCount += localAudioTrack.listenerCount(event);
        });
      } catch (e) {
        error = e;
      }
    });

    it('should have 0 event listeners after disconnecting from multiple rooms', () => {
      assert.strictEqual(listenerCount, 0);
    });

    it('should not throw any errors', () => {
      assert(!error);
    });

    after(() => {
      if (room) {
        room.disconnect();
      }
    });
  });
});
