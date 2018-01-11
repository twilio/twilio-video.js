import * as assert from 'assert';
import VideoDriver from '../../../src/videodriver';
import LocalParticipantDriver from '../../../src/videodriver/localparticipant';
import ParticipantDriver from '../../../src/videodriver/participant';
import RoomDriver from '../../../src/videodriver/room';
const defaults = require('../../../../lib/defaults');
const getToken = require('../../../../lib/token');
const { combinationContext, randomName } = require('../../../../lib/util');

const { REALM, VERSION } = process.env;
const realm: string = REALM || 'prod';
const version: string = VERSION;

describe('LocalParticipantDriver', function() {
  this.timeout(60000);

  describe('#publishTrack', () => {
    combinationContext([
      [
        [true, false],
        x => `when the LocalTrack publishing ${x ? 'succeeds' : 'fails'}`
      ],
      [
        ['chrome', 'firefox'],
        x => `when the Participant publishing the LocalTrack is in ${x}`
      ],
      [
        ['chrome', 'firefox'],
        x => `when the Participant subscribing to the LocalTrack is in ${x}`
      ]
    ], ([ shouldPublishSucceed, ...browsers ]) => {
      let error: any;
      let localTrack: any;
      let localTrackPublication: any;
      let remoteTrack: any;
      let roomDrivers: Array<RoomDriver>;
      let trackEventData: any;
      let videoDrivers: Array<VideoDriver>;

      before(async () => {
        const identities: Array<string> = browsers.map(randomName);
        const name: string = randomName();
        const tokens: Array<string> = identities.map(getToken);

        videoDrivers = browsers.map(browser => new VideoDriver({ browser, realm, version }));
        roomDrivers = await Promise.all(tokens.map((token, i) => videoDrivers[i].connect(token, {
          ...defaults,
          name,
          tracks: []
        })));

        while (roomDrivers[0].participants.size < browsers.length - 1) {
          await new Promise(resolve => roomDrivers[0].once('participantConnected', resolve));
        }

        localTrack = await videoDrivers[0].createLocalAudioTrack({
          name: shouldPublishSucceed ? 'my-cool-audio' : 'x'.repeat(129)
        });

        const localParticipant: LocalParticipantDriver = roomDrivers[0].localParticipant;

        const trackEvent: Promise<any> = new Promise(resolve => {
          localParticipant.once(`track${shouldPublishSucceed ? 'Published' : 'PublicationFailed'}`, resolve);
        });

        const remoteTrackEvent: Promise<any> = shouldPublishSucceed
          ? new Promise(resolve => {
            const participant: ParticipantDriver = Array.from(roomDrivers[1].participants.values())[0];
            participant.once('trackSubscribed', resolve);
          })
          : Promise.resolve();

        try {
          localTrackPublication = await localParticipant.publishTrack(localTrack);
        } catch (e) {
          error = e;
        }

        [ trackEventData, remoteTrack ] = await Promise.all([
          trackEvent,
          remoteTrackEvent
        ]);
      });

      if (shouldPublishSucceed) {
        it('should resolve the returned Promise with a serialized LocalTrackPublication', () => {
          assert.equal(localTrackPublication.kind, localTrack.kind);
          assert.equal(localTrackPublication.trackName, localTrack.name);
          assert.equal(typeof localTrackPublication.trackSid, 'string');
          assert(/^MT[a-z0-9]{32}/.test(localTrackPublication.trackSid));
          ['id', 'kind', 'name'].forEach(prop => {
            assert.equal(localTrackPublication.track[prop], localTrack[prop]);
          });
        });

        it('should include the serialized LocalTrack in the appropriate collections', () => {
          const { id, kind } = localTrack;
          const { localParticipant: { tracks, [`${kind}Tracks`]: kindTracks } } = roomDrivers[0];
          assert(tracks.has(id));
          assert(kindTracks.has(id));
        });

        it('should include the serialized LocalTrackPublication in the appropriate collections', () => {
          const { track: { kind } } = localTrackPublication;
          const { localParticipant: { trackPublications, [`${kind}TrackPublications`]: kindTrackPublications } } = roomDrivers[0];
          assert.deepEqual(localTrackPublication, trackPublications.get(localTrackPublication.trackSid));
          assert.deepEqual(localTrackPublication, kindTrackPublications.get(localTrackPublication.trackSid));
        });

        it('should emit a "trackPublished" event on the LocalParticipantDriver with a serialized LocalTrackPublication', () => {
          assert.deepEqual(trackEventData, localTrackPublication);
        });

        it('should emit a "trackSubscribed" event on the ParticipantDriver with a serialized LocalTrack', () => {
          const { track, trackSid } = localTrackPublication;
          assert.equal(remoteTrack.sid, trackSid);
          ['id', 'kind', 'name'].forEach(prop => {
            assert.equal(remoteTrack[prop], track[prop]);
          });
        });
      } else {
        it('should reject the returned Promise with a TwilioError', () => {
          assert(error instanceof Error);
          assert.equal(typeof error.code, 'number');
          assert.equal(typeof error.message, 'string');
        });

        it('should emit a "trackPublicationFailed" event on the LocalParticipantDriver with a TwilioError', () => {
          assert(trackEventData instanceof Error);
          ['code', 'message'].forEach(prop => {
            assert(trackEventData[prop], error[prop]);
          });
        });
      }

      after(() => {
        roomDrivers.forEach(roomDriver => roomDriver.disconnect());
        videoDrivers.forEach(videoDriver => videoDriver.close());
      });
    });
  });

  describe('#unpublishTrack', () => {
    combinationContext([
      [
        [true, false],
        x => `when the LocalTrack unpublishing ${x ? 'succeeds' : 'fails'}`
      ],
      [
        ['chrome', 'firefox'],
        x => `when the Participant unpublishing the LocalTrack is in ${x}`
      ],
      [
        ['chrome', 'firefox'],
        x => `when the Participant unsubscribing from the LocalTrack is in ${x}`
      ]
    ], ([ shouldUnpublishSucceed, ...browsers ]) => {
      let error: any;
      let localTrack: any;
      let localTrackPublication: any;
      let remoteTrack: any;
      let roomDrivers: Array<RoomDriver>;
      let videoDrivers: Array<VideoDriver>;

      before(async () => {
        const identities: Array<string> = browsers.map(randomName);
        const name: string = randomName();
        const tokens: Array<string> = identities.map(getToken);

        videoDrivers = browsers.map(browser => new VideoDriver({ browser, realm, version }));
        roomDrivers = await Promise.all(tokens.map((token, i) => videoDrivers[i].connect(token, {
          ...defaults,
          name,
          ...(i === 0 ? {} : { tracks: [] })
        })));

        while (roomDrivers[0].participants.size < browsers.length - 1) {
          await new Promise(resolve => roomDrivers[0].once('participantConnected', resolve));
        }

        const localParticipant: LocalParticipantDriver = roomDrivers[0].localParticipant;
        localTrack = shouldUnpublishSucceed ? Array.from(localParticipant.audioTracks.values())[0] : { id: 'foo' };

        const remoteTrackEvent: Promise<any> = shouldUnpublishSucceed
          ? new Promise(resolve => {
            const participant: ParticipantDriver = Array.from(roomDrivers[1].participants.values())[0];
            participant.once('trackUnsubscribed', resolve);
          })
          : Promise.resolve();

        try {
          localTrackPublication = await localParticipant.unpublishTrack(localTrack);
        } catch (e) {
          error = e;
        }

        remoteTrack = await remoteTrackEvent;
      });

      if (shouldUnpublishSucceed) {
        it('should resolve the returned Promise with a serialized LocalTrackPublication', () => {
          assert.equal(localTrackPublication.kind, localTrack.kind);
          assert.equal(localTrackPublication.trackName, localTrack.name);
          assert.equal(typeof localTrackPublication.trackSid, 'string');
          assert(/^MT[a-z0-9]{32}/.test(localTrackPublication.trackSid));
          ['id', 'kind', 'name'].forEach(prop => {
            assert.equal(localTrackPublication.track[prop], localTrack[prop]);
          });
        });

        it('should remove the serialized LocalTrackPublication from the appropriate collections', () => {
          const { track: { kind } } = localTrackPublication;
          const { localParticipant: { trackPublications, [`${kind}TrackPublications`]: kindTrackPublications } } = roomDrivers[0];
          assert(!trackPublications.has(localTrackPublication.trackSid));
          assert(!kindTrackPublications.has(localTrackPublication.trackSid));
        });

        it('should remove the serialized LocalTrack from the appropriate collections', () => {
          const { id, kind } = localTrack;
          const { localParticipant: { tracks, [`${kind}Tracks`]: kindTracks } } = roomDrivers[0];
          assert(!tracks.has(id));
          assert(!kindTracks.has(id));
        });

        it('should emit a "trackUnsubscribed" event on the ParticipantDriver with a serialized LocalTrack', () => {
          const { track, trackSid } = localTrackPublication;
          assert.equal(remoteTrack.sid, trackSid);
          ['id', 'kind', 'name'].forEach(prop => {
            assert.equal(remoteTrack[prop], track[prop]);
          });
        });
      } else {
        it('should reject the returned Promise with an Error', () => {
          assert(error instanceof Error);
        });
      }

      after(() => {
        roomDrivers.forEach(roomDriver => roomDriver.disconnect());
        videoDrivers.forEach(videoDriver => videoDriver.close());
      });
    });
  });
});
