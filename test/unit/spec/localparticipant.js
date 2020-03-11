/* eslint-disable no-undefined */
'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');
const { inherits } = require('util');

const DataTrackSender = require('../../../lib/data/sender');
const LocalParticipant = require('../../../lib/localparticipant');
const LocalTrackPublicationSignaling = require('../../../lib/signaling/localtrackpublication');
const MediaTrackSender = require('../../../lib/media/track/sender');

const {
  trackPriority: { PRIORITY_HIGH, PRIORITY_LOW, PRIORITY_STANDARD }
} = require('../../../lib/util/constants');

const log = require('../../lib/fakelog');
const { FakeMediaStreamTrack } = require('../../lib/fakemediastream');
const { capitalize, combinationContext } = require('../../lib/util');

const LocalAudioTrack = sinon.spy(function LocalAudioTrack(mediaStreamTrack, options) {
  mediaStreamTrack = mediaStreamTrack || new FakeMediaStreamTrack('audio');
  options = options || {};
  EventEmitter.call(this);
  this.id = mediaStreamTrack.id;
  this.kind = mediaStreamTrack.kind;
  this.mediaStreamTrack = mediaStreamTrack;
  this.name = options.name || mediaStreamTrack.id;
  this._trackSender = new MediaTrackSender(this.mediaStreamTrack);
  this.stop = sinon.spy();
});
inherits(LocalAudioTrack, EventEmitter);

const LocalVideoTrack = sinon.spy(function LocalVideoTrack(mediaStreamTrack, options) {
  mediaStreamTrack = mediaStreamTrack || new FakeMediaStreamTrack('video');
  options = options || {};
  EventEmitter.call(this);
  this.id = mediaStreamTrack.id;
  this.kind = mediaStreamTrack.kind;
  this.mediaStreamTrack = mediaStreamTrack;
  this.name = options.name || mediaStreamTrack.id;
  this._trackSender = new MediaTrackSender(this.mediaStreamTrack);
  this.stop = sinon.spy();
});
inherits(LocalVideoTrack, EventEmitter);

const LocalDataTrack = sinon.spy(function LocalDataTrack(dataTrackSender, options) {
  dataTrackSender = dataTrackSender || new DataTrackSender();
  options = options || {};
  EventEmitter.call(this);
  this.id = dataTrackSender.id;
  this.kind = 'data';
  this.name = options.name || dataTrackSender.id;
  this._trackSender = dataTrackSender;
});
inherits(LocalDataTrack, EventEmitter);

describe('LocalParticipant', () => {
  describe('constructor', () => {
    context('when a room is joined', () => {
      it('should have the updated "identity" and "sid"', () => {
        // In makeTest(), test.signaling.sid and test.signaling.identity are
        // set to null, to mimic the ParticipantSignaling constructor
        const test = makeTest({ state: 'connecting' });
        // Spoofing a room joining event by populating the
        // "identity" and "sid" members of the signaling instance
        test.signaling.identity = 'newIdentity';
        test.signaling.sid = 'newSid';
        // Now, localParticipant should have the updated "identity" and "sid"
        assert.equal(test.signaling.sid, test.participant.sid);
        assert.equal(test.signaling.identity, test.participant.identity);
      });
    });
  });

  [
    'publishTracks',
    'unpublishTracks',
  ].forEach(method => {
    describe(`#${method}`, () => {
      let test;

      beforeEach(() => {
        test = makeTest();
        if (method === 'publishTracks') {
          mockPublishTrack(test.participant);
        } else {
          mockUnpublishTrack(test.participant);
        }
      });

      context('when called with an invalid argument', () => {
        it('should throw', () => {
          assert.throws(() => test.participant[method]('invalid tracks argument'));
        });
      });

      context('when called with an array of', () => {
        [
          [
            'LocalTracks',
            LocalAudioTrack.bind(null, new FakeMediaStreamTrack('audio')),
            LocalVideoTrack.bind(null, new FakeMediaStreamTrack('video')),
            LocalDataTrack.bind(null, new DataTrackSender(null, null, true)),
          ],
          [
            'MediaStreamTracks',
            FakeMediaStreamTrack.bind(null, 'audio'),
            FakeMediaStreamTrack.bind(null, 'video'),
            LocalDataTrack.bind(null, new DataTrackSender(null, null, true))
          ]
        ].forEach(([arrayItemType, LocalAudioTrack, LocalVideoTrack, LocalDataTrack]) => {
          context(arrayItemType, () => {
            it('should not throw', () => {
              assert.doesNotThrow(() => test.participant[method]([
                new LocalAudioTrack(),
                new LocalVideoTrack(),
                new LocalDataTrack()
              ]));
            });

            if (method === 'publishTracks') {
              it('should return a Promise for an array of LocalTrackPublications', async () => {
                const tracks = [
                  new LocalAudioTrack(),
                  new LocalVideoTrack(),
                  new LocalDataTrack()
                ];
                const publications = await test.participant[method](tracks);
                assert(Array.isArray(publications));
                assert.equal(publications.length, tracks.length);
                publications.forEach((publication, i) => assert.equal(publication.track, tracks[i]));
              });
            }
          });
        });
      });
    });
  });

  describe('.networkQualityLevel', () => {
    it('equals the underlying ParticipantSignaling\'s .networkQualityLevel', () => {
      const test = makeTest();

      test.signaling.networkQualityLevel = null;
      assert.equal(test.participant.networkQualityLevel, test.signaling.networkQualityLevel);

      test.signaling.networkQualityLevel = 0;
      assert.equal(test.participant.networkQualityLevel, test.signaling.networkQualityLevel);

      test.signaling.networkQualityLevel = 2;
      assert.equal(test.participant.networkQualityLevel, test.signaling.networkQualityLevel);
    });
  });

  describe('#setNetworkQualityConfiguration', () => {
    let test;

    context('when the NetworkQualityConfiguration is', () => {
      [
        [undefined, 'undefined'],
        [null, 'null'],
        ['foo', 'not an object'],
        [{ local: 'bar', remote: 1 }, 'an object that has .local which is not a number'],
        [{ local: NaN, remote: 1 }, 'an object that has .local which is NaN'],
        [{ local: 2, remote: false }, 'an object that has .remote which is not a number'],
        [{ local: 2, remote: NaN }, 'an object that has .remote which is NaN'],
        [{ local: 'foo', remote: null }, 'an object which has both .local and .remote which are not numbers']
      ].forEach(([networkQualityConfiguration, scenario]) => {
        context(scenario, () => itShould(networkQualityConfiguration, true));
      });

      [
        [{}, 'an object which does not have .local and .remote'],
        [{ remote: 1 }, 'an object that does not have .local'],
        [{ local: 2 }, 'an object that does not have .remote'],
        [{ local: 1, remote: 2 }, 'an object which has both .local and .remote which are numbers']
      ].forEach(([networkQualityConfiguration, scenario]) => {
        context(scenario, () => itShould(networkQualityConfiguration, false));
      });
    });

    function itShould(networkQualityConfiguration, throwAndFail) {
      before(() => {
        test = makeTest();
      });

      it(`should ${throwAndFail ? '' : 'not '}throw`, () => {
        assert[throwAndFail ? 'throws' : 'doesNotThrow'](() => test.participant.setNetworkQualityConfiguration(networkQualityConfiguration));
      });

      it(`should ${throwAndFail ? 'not ' : ''}call .setNetworkQualityConfiguration on the underlying ParticipantSignaling`, () => {
        sinon.assert.callCount(test.signaling.setNetworkQualityConfiguration, throwAndFail ? 0 : 1);
        if (!throwAndFail) {
          sinon.assert.calledWith(test.signaling.setNetworkQualityConfiguration, networkQualityConfiguration);
        }
      });
    }
  });

  describe('#setParameters', () => {
    let test;

    context('when the EncodingParameters is', () => {
      [
        ['foo', 'not an object'],
        [{ maxAudioBitrate: 'bar', maxVideoBitrate: 1000 }, 'an object that has .maxAudioBitrate which is not a number'],
        [{ maxAudioBitrate: 1000, maxVideoBitrate: false }, 'an object that has .maxVideoBitrate which is not a number'],
        [{ maxAudioBitrate: 'foo', maxVideoBitrate: true }, 'an object which has both .maxAudioBitrate and .maxVideoBitrate which are not numbers']
      ].forEach(([encodingParameters, scenario]) => {
        context(scenario, () => itShould(encodingParameters, true));
      });

      [
        [undefined, 'undefined'],
        [null, 'null'],
        [{}, 'an object which does not have .maxAudioBitrate and .maxVideoBitrate'],
        [{ maxAudioBitrate: null, maxVideoBitrate: null }, 'an object where both .maxAudioBitrate and .maxVideoBitrate are null'],
        [{ maxVideoBitrate: 1000 }, 'an object that does not have .maxAudioBitrate'],
        [{ maxAudioBitrate: null, maxVideoBitrate: 1000 }, 'an object where .maxAudioBitrate is null'],
        [{ maxAudioBitrate: 1000 }, 'an object that does not have .maxVideoBitrate'],
        [{ maxAudioBitrate: 1000, maxVideoBitrate: null }, 'an object where .maxVideoBitrate is null'],
        [{ maxAudioBitrate: 1000, maxVideoBitrate: 2000 }, 'an object which has both .maxAudioBitrate and .maxVideoBitrate which are numbers']
      ].forEach(([encodingParameters, scenario]) => {
        context(scenario, () => itShould(encodingParameters, false));
      });
    });

    function itShould(encodingParameters, throwAndFail) {
      before(() => {
        test = makeTest();
      });

      it(`should ${throwAndFail ? '' : 'not '}throw`, () => {
        assert[throwAndFail ? 'throws' : 'doesNotThrow'](() => test.participant.setParameters(encodingParameters));
      });

      it(`should ${throwAndFail ? 'not ' : ''}call .setParameters on the underlying ParticipantSignaling`, () => {
        sinon.assert.callCount(test.signaling.setParameters, throwAndFail ? 0 : 1);
        if (!throwAndFail) {
          sinon.assert.calledWith(test.signaling.setParameters, encodingParameters === null
            ? { maxAudioBitrate: null, maxVideoBitrate: null }
            : encodingParameters);
        }
      });
    }
  });

  describe('#publishTrack', () => {
    let options;
    let test;

    beforeEach(() => {
      options = {
        LocalAudioTrackPublication: function(signaling, track) {
          this.trackName = track.name;
          this.trackSid = signaling.sid;
          this.track = track;
          this.kind = track.kind;
          this.priority = signaling.priority;
          this.on = () => {};
          this.removeListener = () => {};
        },
        LocalVideoTrackPublication: function(signaling, track) {
          this.trackName = track.name;
          this.trackSid = signaling.sid;
          this.track = track;
          this.kind = track.kind;
          this.priority = signaling.priority;
          this.on = () => {};
          this.removeListener = () => {};
        },
        LocalDataTrackPublication: function(signaling, track) {
          this.trackName = track.name;
          this.trackSid = signaling.sid;
          this.track = track;
          this.kind = track.kind;
          this.priority = signaling.priority;
          this.on = () => {};
          this.removeListener = () => {};
        }
      };
      test = makeTest(options);
    });

    context('when called with an invalid first argument', () => {
      [
        [
          'should return a rejected Promise with a TypeError',
          error => error instanceof TypeError
        ],
        [
          'should not call .addTrack on the underlying ParticipantSignaling',
          (error, addTrack) => addTrack.callCount === 0
        ]
      ].forEach(([expectation, assertion]) => {
        it(`${expectation}`, async () => {
          try {
            await test.participant.publishTrack('invalid track argument');
          } catch (error) {
            assert(assertion(error, test.signaling.addTrack));
            return;
          }
          throw new Error('Unexpected resolution');
        });
      });
    });

    [2, 'baz'].forEach(priority => {
      context(`when called with a TrackPriority that is ${typeof priority === 'string' ? 'invalid' : 'not a string'}`, () => {
        it('should return a rejected Promise with a RangeError', async () => {
          const localTrack = new LocalVideoTrack(new FakeMediaStreamTrack('audio'));
          try {
            await test.participant.publishTrack(localTrack, { priority });
          } catch (error) {
            assert(error instanceof RangeError);
            assert(test.signaling.addTrack.notCalled);
            return;
          }
          throw new Error('Unexpected resolution');
        });
      });
    });

    combinationContext([
      [
        ['LocalTrack', 'MediaStreamTrack'],
        x => `when called with a ${x}`
      ],
      [
        ['audio', 'data', 'video'],
        x => `of kind ${x}`
      ],
      [
        [undefined, PRIORITY_HIGH, PRIORITY_LOW, PRIORITY_STANDARD],
        x => `with priority ${x ? `"${x}"` : 'not specified'}`
      ]
    ], ([trackType, kind, priority]) => {
      if (trackType === 'MediaStreamTrack' && kind === 'data') {
        return;
      }

      function createTrack() {
        return {
          LocalTrack: {
            audio: () => new LocalAudioTrack(new FakeMediaStreamTrack(kind)),
            data: () => new LocalDataTrack(new DataTrackSender(null, null, true)),
            video: () => new LocalVideoTrack(new FakeMediaStreamTrack(kind))
          },
          MediaStreamTrack: {
            audio: () => new FakeMediaStreamTrack(kind),
            video: () => new FakeMediaStreamTrack(kind)
          }
        }[trackType][kind]();
      }

      function publishTrack(track, options = {}) {
        return {
          LocalTrack: priority
            ? () => test.participant.publishTrack(track, { priority })
            : () => test.participant.publishTrack(track),
          MediaStreamTrack: priority
            ? () => test.participant.publishTrack(track, Object.assign({ priority }, options))
            : () => test.participant.publishTrack(track, options)
        }[trackType]();
      }

      [true, false].forEach(isConnected => {
        context(`and the LocalParticipant's ParticipantSignaling is in the "${isConnected ? 'connected' : 'connecting'}" state`, () => {
          context(`when the .tracks collection already has an entry for the ${trackType}`, () => {
            let localTrack;

            beforeEach(async () => {
              localTrack = createTrack();
              const promise = publishTrack(localTrack);
              const trackSignaling = test.participant._signaling.tracks.get(localTrack.id);
              trackSignaling.setSid('foo');
              await promise;
              await new Promise(resolve => test.participant.on('trackPublished', resolve));
            });

            it('should return a Promise that is resolved with the entry from the .tracks', async () => {
              const localTrackPublication = await publishTrack(localTrack);
              assert.equal(localTrackPublication, test.participant.tracks.get('foo'));
            });

            it('should not raise a "trackPublished" event', async () => {
              let trackPublishedEvent;
              test.participant.on('trackPublished', () => { trackPublishedEvent = true; });
              await publishTrack(localTrack);
              await new Promise(resolve => setTimeout(resolve));
              assert(!trackPublishedEvent);
            });
          });

          [true, false].forEach(hasLocalTrack => {
            context(`when the .tracks collection ${hasLocalTrack ? 'already has' : 'doesn\'t have'} an entry for the ${trackType}'s .id`, () => {
              let localTrack;
              let localTrackPublication;
              let trackPublishedEvent;

              beforeEach(async () => {
                test.signaling.state = isConnected ? 'connected' : 'connecting';
                localTrack = createTrack();
                if (hasLocalTrack) {
                  publishTrack(localTrack);
                  test.signaling.addTrack.resetHistory();
                }
                const promise = trackType === 'LocalTrack'
                  ? publishTrack(localTrack)
                  : publishTrack(localTrack, { name: 'bar' });
                test.participant._signaling.tracks.get(localTrack.id).setSid('foo');
                localTrackPublication = await promise;
                trackPublishedEvent = null;
                test.participant.on('trackPublished', publication => { trackPublishedEvent = publication; });
                await new Promise(resolve => setTimeout(resolve));
              });

              it(`should ${hasLocalTrack ? 'not ' : ''}call .addTrack on the underlying ParticipantSignaling with the corresponding MediaStreamTrack and LocalTrack name`, () => {
                if (hasLocalTrack) {
                  sinon.assert.notCalled(test.signaling.addTrack);
                  return;
                }
                sinon.assert.calledOnce(test.signaling.addTrack);
                assert(test.signaling.addTrack.args[0][0] instanceof MediaTrackSender
                  || test.signaling.addTrack.args[0][0] instanceof DataTrackSender);
                assert.equal(test.signaling.addTrack.args[0][1], (hasLocalTrack || trackType === 'LocalTrack') ? localTrack.id : 'bar');
                assert.equal(test.signaling.addTrack.args[0][2], priority || PRIORITY_STANDARD);
              });

              context('when the SID is set for the underlying LocalTrackPublicationSignaling', () => {
                const otherKinds = {
                  audio: ['video', 'data'],
                  video: ['audio', 'data'],
                  data: ['audio', 'video']
                }[kind];

                it(`should resolve the returned Promise with a ${capitalize(kind)}TrackPublication`, () => {
                  const LocalTrackPublication = options[`Local${capitalize(kind)}TrackPublication`];
                  assert(localTrackPublication instanceof LocalTrackPublication);
                  assert.equal(localTrackPublication.trackName, (hasLocalTrack || trackType === 'LocalTrack') ? localTrack.id : 'bar');
                  assert.equal(localTrackPublication.trackSid, 'foo');
                  assert.equal(localTrackPublication.track.id, localTrack.id);
                  assert.equal(localTrackPublication.priority, priority || PRIORITY_STANDARD);
                });

                if (isConnected) {
                  it('should raise a "trackPublished" event with the LocalTrackPublication after the Promise resolves', () => {
                    assert.equal(trackPublishedEvent, localTrackPublication);
                  });
                } else {
                  it('should not raise a "trackPublished" event', () => {
                    assert(!trackPublishedEvent);
                  });
                }

                it(`should add the ${capitalize(kind)}TrackPublication to the .tracks and .${kind}Tracks collections`, () => {
                  assert.equal(localTrackPublication, test.participant.tracks.get(localTrackPublication.trackSid));
                  assert.equal(localTrackPublication, test.participant[`${kind}Tracks`].get(localTrackPublication.trackSid));
                });

                otherKinds.forEach(otherKind => {
                  it(`should not add the ${capitalize(kind)}TrackPublication to the .${otherKind}Tracks collection`, () => {
                    assert(!test.participant[`${otherKind}Tracks`].has(localTrack.id));
                  });
                });
              });

              context('when there is an error while setting the SID for the underlying LocalTrackPublicationSignaling', () => {
                let actualError;
                let expectedError;
                let localTrack2;
                let trackPublicationFailedEvent;

                beforeEach(async () => {
                  actualError = null;
                  expectedError = new Error();
                  localTrack2 = createTrack();
                  const promise = publishTrack(localTrack2);
                  const localTrackSignaling = test.participant._signaling.tracks.get(localTrack2.id);
                  localTrackSignaling.publishFailed(expectedError);
                  try {
                    await promise;
                  } catch (error) {
                    actualError = error;
                    trackPublicationFailedEvent = null;
                    test.participant.on('trackPublicationFailed', (error, localTrack) => {
                      if (trackType === 'LocalTrack') {
                        trackPublicationFailedEvent = [error, localTrack];
                      } else {
                        trackPublicationFailedEvent = [error, localTrack.mediaStreamTrack];
                      }
                    });
                    await new Promise(resolve => setTimeout(resolve));
                    return;
                  }
                  throw new Error('Unexpectedly resolved');
                });

                it('should reject the returned Promise with the given error', () => {
                  assert.equal(actualError, expectedError);
                });

                it('should raise a "trackPublicationFailed" event with the error and failed LocalTrack after the Promise rejects', () => {
                  assert.deepEqual(trackPublicationFailedEvent, [expectedError, localTrack2]);
                });

                it(`should not add the Local${capitalize(kind)}Track to the ._tracks collection`, () => {
                  assert(!test.participant._tracks.has(localTrack2.id));
                });
              });
            });
          });
        });
      });
    });
  });

  describe('#unpublishTrack', () => {
    let test;

    beforeEach(() => {
      test = makeTest();
    });

    context('when called with an invalid argument', () => {
      [
        [
          'should throw a TypeError',
          error => error instanceof TypeError
        ],
        [
          'should not call .removeTrack on the underlying ParticipantSignaling',
          (error, removeTrack) => removeTrack.callCount === 0
        ]
      ].forEach(([expectation, assertion]) => {
        it(`${expectation}`, () => {
          try {
            test.participant.unpublishTrack('invalid track argument');
          } catch (error) {
            assert(assertion(error, test.signaling.removeTrack));
            return;
          }
          throw new Error('Unexpected success');
        });
      });
    });

    [
      [
        'LocalTrack',
        kind => ({
          audio: new LocalAudioTrack(new FakeMediaStreamTrack(kind)),
          video: new LocalVideoTrack(new FakeMediaStreamTrack(kind)),
          data: new LocalDataTrack(new DataTrackSender(null, null, true))
        }[kind])
      ],
      [
        'MediaStreamTrack',
        kind => ({
          audio: new FakeMediaStreamTrack(kind),
          video: new FakeMediaStreamTrack(kind),
          data: new LocalDataTrack(new DataTrackSender(null, null, true))
        }[kind])
      ]
    ].forEach(([trackType, createTrack]) => {
      [
        'audio',
        'video',
        'data'
      ].forEach(kind => {
        let localTrack;

        context(`when the .tracks collection has an entry for the given ${kind} ${trackType}`, () => {
          context(`and the ._tracks collection has an entry for the given ${kind} ${trackType}'s .id`, () => {
            let ret;
            let track;

            beforeEach(() => {
              localTrack = createTrack(kind);

              track = new test[`Local${capitalize(kind)}Track`](
                (localTrack instanceof FakeMediaStreamTrack || localTrack instanceof DataTrackSender)
                  ? localTrack : (localTrack.mediaStreamTrack || localTrack._trackSender));

              test.signaling.tracks.set(localTrack.id, makeTrackSignaling(localTrack.id, 'foo'));
              test.participant._tracks.set(localTrack.id, track);
              test.participant[`_${kind}Tracks`].set(localTrack.id, track);
              test.participant.tracks.set('foo', { track, sid: 'foo' });
              test.participant[`${kind}Tracks`].set('foo', { track, sid: 'foo' });
              ret = test.participant.unpublishTrack(localTrack);
            });

            it(`should remove the ${kind} ${trackType} from the ._tracks and ._${kind}Tracks collections`, () => {
              assert(!test.participant._tracks.has(localTrack.id));
              assert(!test.participant[`_${kind}Tracks`].has(localTrack.id));
            });

            it(`should remove the ${kind} ${trackType}'s entry from the .tracks and .${kind}Tracks collections`, () => {
              assert(!test.participant.tracks.has(localTrack.id));
              assert(!test.participant[`${kind}Tracks`].has(localTrack.id));
            });

            it('should call .removeTrack on the underlying ParticipantSignaling with the corresponding MediaStreamTrack', () => {
              assert(test.signaling.removeTrack.args[0][0] instanceof MediaTrackSender
                || test.signaling.removeTrack.args[0][0] instanceof DataTrackSender);
            });

            it(`should return the LocalTrackPublication corresponding to the unpublished ${kind} ${trackType}`, () => {
              assert.equal(ret.sid, 'foo');
              assert.equal(ret.track.id, localTrack.id);
            });
          });
        });

        context(`when the .tracks collection does not have an entry for the given ${kind} ${trackType}`, () => {
          context(`and the ._tracks collection has the given ${kind} ${trackType}`, () => {
            let ret;
            let track;
            let trackSignaling;

            beforeEach(() => {
              localTrack = createTrack(kind);

              track = new test[`Local${capitalize(kind)}Track`](
                (localTrack instanceof FakeMediaStreamTrack || localTrack instanceof DataTrackSender)
                  ? localTrack : (localTrack.mediaStreamTrack || localTrack._trackSender));

              trackSignaling = makeTrackSignaling(localTrack.id, 'foo');
              test.signaling.tracks.set(localTrack.id, trackSignaling);
              test.participant._tracks.set(localTrack.id, track);
              test.participant[`_${kind}Tracks`].set(localTrack.id, track);
              ret = test.participant.unpublishTrack(localTrack);
            });

            it(`should remove the ${kind} ${trackType} from the ._tracks and ._${kind}Tracks collections`, () => {
              assert(!test.participant._tracks.has(localTrack.id));
              assert(!test.participant[`_${kind}Tracks`].has(localTrack.id));
            });

            it('should reject the pending Promise returned by the previous call to LocalParticipant#publishTrack', () => {
              assert(trackSignaling.publishFailed.args[0][0] instanceof Error);
            });

            it('should call .removeTrack on the underlying ParticipantSignaling with the corresponding MediaStreamTrack', () => {
              assert(test.signaling.removeTrack.args[0][0] instanceof MediaTrackSender
                || test.signaling.removeTrack.args[0][0] instanceof DataTrackSender);
            });

            it('should return null', () => {
              assert.equal(ret, null);
            });
          });

          context(`and the ._tracks collection does not have the given ${kind} ${trackType}`, () => {
            beforeEach(() => {
              localTrack = createTrack(kind);
            });

            it('should not throw', () => {
              assert.doesNotThrow(() => test.participant.unpublishTrack(localTrack));
            });

            it('should not call .removeTrack on the underlying ParticipantSignaling', () => {
              test.participant.unpublishTrack(localTrack);
              sinon.assert.callCount(test.signaling.removeTrack, 0);
            });

            it('should return null', () => {
              assert.equal(test.participant.unpublishTrack(localTrack), null);
            });
          });
        });
      });
    });
  });

  describe('LocalTrack events', () => {
    ['disable', 'enable'].forEach(trackMethod => {
      context(`"track${capitalize(trackMethod)}d" event`, () => {
        ['connecting', 'connected'].forEach(state => {
          context(`when the LocalParticipant .state is "${state}"`, () => {
            it(`should call .${trackMethod} on the LocalTrack's LocalTrackPublicationSignaling`, () => {
              const test = makeTest({ state });
              const track = { id: 'foo', _trackSender: { track: { enabled: true } } };
              const trackSignaling = { id: 'foo', [trackMethod]: sinon.spy() };
              test.signaling.tracks = { get: () => trackSignaling };
              test.participant.emit(`track${capitalize(trackMethod)}d`, track);
              sinon.assert.calledOnce(trackSignaling[trackMethod]);
            });
          });
        });

        ['is', 'transitions to'].forEach(action => {
          context(`when the LocalParticipant .state ${action} "disconnected"`, () => {
            it(`should not call .${trackMethod} on the LocalTrack's LocalTrackPublicationSignaling`, () => {
              const test = makeTest({ state: action === 'is' ? 'disconnected' : 'connected' });
              const track = { id: 'foo', _trackSender: { track: { enabled: true } } };
              const trackSignaling = { id: 'foo', [trackMethod]: sinon.spy() };

              test.signaling.tracks = { forEach: fn => fn(trackSignaling), get: () => trackSignaling };
              if (action === 'transitions to') {
                test.signaling.emit('stateChanged', 'disconnected');
              }

              test.participant.emit(`track${capitalize(trackMethod)}d`, track);
              assert(!trackSignaling[trackMethod].calledOnce);
            });
          });
        });
      });
    });

    context('"trackStopped" event', () => {
      context('when the LocalParticipant .state begins in "connecting"', () => {
        context('and a LocalTrack emits "stopped"', () => {
          let track;
          let test;
          let trackSignaling;

          beforeEach(() => {
            track = new EventEmitter();
            track.stop = sinon.spy();
            track._trackSender = {
              clone() {
                return track._trackSender;
              },
              track: {
                enabled: true
              }
            };
            test = makeTest({ tracks: [track] });
            trackSignaling = test.signaling.tracks.get(track.id);
            trackSignaling.stop = sinon.spy();
          });

          it('emits "trackStopped"', () => {
            let trackStopped;
            test.participant.once('trackStopped', track => { trackStopped = track; });
            track.emit('stopped', track);
            assert.equal(track, trackStopped);
          });

          it('calls .stop on the LocalTrackPublicationSignaling', () => {
            track.emit('stopped', track);
            assert(trackSignaling.stop.calledOnce);
          });
        });
      });

      context('when the LocalParticipant .state transitions to "disconnected"', () => {
        context('and a LocalTrack emits "stopped"', () => {
          it('does not emit "trackStopped"', () => {
            const track = new EventEmitter();
            track._trackSender = {
              clone() {
                return track._trackSender;
              },
              stop() {
                return true;
              },
              track: {
                enabled: true
              }
            };
            let trackStopped;
            const test = makeTest({ tracks: [track] });
            test.signaling.emit('stateChanged', 'disconnected');
            test.participant.once('trackStopped', track => { trackStopped = track; });
            track.emit('stopped', track);
            assert(!trackStopped);
          });
        });
      });

      context('when the LocalParticipant .state begins in "disconnected"', () => {
        context('and a LocalTrack emits "stopped"', () => {
          it('does not emit "trackStopped"', () => {
            const track = new EventEmitter();
            let trackStopped;
            const test = makeTest({ tracks: [track], state: 'disconnected' });
            test.participant.once('trackStopped', track => { trackStopped = track; });
            track.emit('stopped', track);
            assert(!trackStopped);
          });
        });
      });
    });

    context('.tracks', () => {
      context('when the LocalParticipant .state is "connecting"', () => {
        it('calls .addTrack with each LocalTrack\'s MediaStreamTrack and name on the ParticipantSignaling', () => {
          const track = new EventEmitter();
          track.id = 'foo';
          track._trackSender = {
            clone() {
              return track._trackSender;
            },
            track: {
              enabled: true
            }
          };
          track.name = 'baz';
          const test = makeTest({
            state: 'connecting',
            tracks: [track]
          });
          assert.equal(track._trackSender, test.signaling.addTrack.args[0][0]);
          assert.equal(track.name, test.signaling.addTrack.args[0][1]);
        });
      });

      context('when the LocalParticipant .state is "connected"', () => {
        it('calls .addTrack with each LocalTrack\'s MediaStreamTrack and name on the ParticipantSignaling', () => {
          const track = new EventEmitter();
          track.id = 'foo';
          track._trackSender = {
            clone() {
              return track._trackSender;
            },
            track: {
              enabled: true
            }
          };
          track.name = 'baz';
          const test = makeTest({
            state: 'connected',
            tracks: [track]
          });
          assert.equal(track._trackSender, test.signaling.addTrack.args[0][0]);
          assert.equal(track.name, test.signaling.addTrack.args[0][1]);
        });
      });

      context('when the LocalParticipant .state is "disconnected"', () => {
        it('does not call .addTrack with each LocalTrack\'s MediaStreamTrack and name on the ParticipantSignaling', () => {
          const track = new EventEmitter();
          track.id = 'foo';
          track._trackSender = { track: { enabled: true } };
          const test = makeTest({
            state: 'disconnected',
            tracks: [track]
          });
          assert(!test.signaling.addTrack.calledOnce);
        });
      });
    });
  });

  describe('ParticipantSignaling', () => {
    context('"stateChanged" event', () => {
      context('when the LocalParticipant .state is "connecting"', () => {
        it('re-emits "stateChanged" event states', () => {
          const test = makeTest({ state: 'connecting' });
          let stateChanged;
          test.participant.once('foo', participant => { stateChanged = participant; });
          test.signaling.emit('stateChanged', 'foo');
          assert.equal(
            test.participant,
            stateChanged);
        });
      });

      context('when the LocalParticipant .state is "connected"', () => {
        it('re-emits "stateChanged" event states', () => {
          const test = makeTest({ state: 'connected' });
          let stateChanged;
          test.participant.once('foo', participant => { stateChanged = participant; });
          test.signaling.emit('stateChanged', 'foo');
          assert.equal(
            test.participant,
            stateChanged);
        });
      });

      context('when the LocalParticipant .state is "reconnecting"', () => {
        it('re-emits "stateChanged" event states', () => {
          const test = makeTest({ state: 'reconnecting' });
          let stateChanged;
          test.participant.once('foo', participant => { stateChanged = participant; });
          test.signaling.emit('stateChanged', 'foo');
          assert.equal(
            test.participant,
            stateChanged);
        });
      });

      context('when the LocalParticipant .state is "disconnected"', () => {
        it('does not re-emit "stateChanged" event states', () => {
          const test = makeTest({ state: 'disconnected' });
          let stateChanged;
          test.participant.once('foo', () => { stateChanged = true; });
          test.signaling.emit('stateChanged', 'foo');
          assert(!stateChanged);
        });
      });

      context('when the LocalParticipant .state transitions to "disconnected"', () => {
        let test;
        let tracks1;
        let tracks1ClonesStopped;
        let tracks2;
        let tracks2ClonesStopped;

        beforeEach(() => {
          tracks1 = [];
          tracks2 = [];
          [tracks1, tracks2].forEach(tracks => {
            const audioTrack = new LocalAudioTrack(new FakeMediaStreamTrack('audio'), { log });
            tracks.push(audioTrack);

            const videoTrack = new LocalVideoTrack(new FakeMediaStreamTrack('video'), { log });
            tracks.push(videoTrack);
          });
        });

        context('and shouldStopLocalTracks is true', () => {
          beforeEach(() => {
            test = makeTest({
              LocalAudioTrack,
              LocalVideoTrack,
              shouldStopLocalTracks: true,
              state: 'connected',
              tracks: tracks1
            });

            tracks1ClonesStopped = 0;
            tracks2ClonesStopped = 0;

            test.participant._signaling.tracks.forEach(trackSignaling => {
              trackSignaling.trackTransceiver.once('stopped', () => tracks1ClonesStopped++);
            });

            tracks2.forEach(track => {
              test.participant.publishTrack(track);
              const trackSignaling = test.participant._signaling.tracks.get(track.id);
              trackSignaling.trackTransceiver.once('stopped', () => tracks2ClonesStopped++);
            });

            test.signaling.emit('stateChanged', 'disconnected');
          });

          it('stops any LocalTracks passed at construction', () => {
            tracks1.forEach(track => sinon.assert.calledOnce(track.stop));
          });

          it('stops the cloned MediaTrackSenders of LocalTracks passed at construction', () => {
            assert.equal(tracks1ClonesStopped, tracks1.length);
          });

          it('does not stop any LocalTracks added after construction', () => {
            tracks2.forEach(track => sinon.assert.notCalled(track.stop));
          });

          it('stops the cloned MediaTrackSenders of LocalTracks added after construction', () => {
            assert.equal(tracks2ClonesStopped, tracks2.length);
          });
        });

        context('and shouldStopLocalTracks is false', () => {
          beforeEach(() => {
            test = makeTest({
              LocalAudioTrack,
              LocalVideoTrack,
              shouldStopLocalTracks: false,
              state: 'connected',
              tracks: tracks1
            });

            tracks1ClonesStopped = 0;
            tracks2ClonesStopped = 0;

            test.participant._signaling.tracks.forEach(trackSignaling => {
              trackSignaling.trackTransceiver.once('stopped', () => tracks1ClonesStopped++);
            });

            tracks2.forEach(track => {
              test.participant.publishTrack(track);
              const trackSignaling = test.participant._signaling.tracks.get(track.id);
              trackSignaling.trackTransceiver.once('stopped', () => tracks2ClonesStopped++);
            });

            test.signaling.emit('stateChanged', 'disconnected');
          });

          it('does not stop any LocalTracks passed at construction', () => {
            tracks1.forEach(track => sinon.assert.notCalled(track.stop));
          });

          it('stops the cloned MediaTrackSenders of LocalTracks passed at construction', () => {
            assert.equal(tracks1ClonesStopped, tracks1.length);
          });

          it('does not stop any LocalTracks added after construction', () => {
            tracks2.forEach(track => sinon.assert.notCalled(track.stop));
          });

          it('stops the cloned MediaTrackSenders of LocalTracks added after construction', () => {
            assert.equal(tracks2ClonesStopped, tracks2.length);
          });
        });

        it('does not re-emit "stateChanged" event states', () => {
          const test = makeTest({ state: 'connected' });
          test.signaling.emit('stateChanged', 'disconnected');
          let stateChanged;
          test.participant.once('foo', () => { stateChanged = true; });
          test.signaling.emit('stateChanged', 'foo');
          assert(!stateChanged);
        });
      });
    });

    context('"networkQualityLevelChanged"', () => {
      ['connected', 'connected'].forEach(state => {
        context(`when the LocalParticipant .state is "${state}"`, () => {
          it('re-emits the "networkQualityLevelChanged" event', () => {
            const test = makeTest({ state });
            const expectedNetworkQualityLevel = 1;
            let actualNetworkQualityLevel;
            test.participant.once('networkQualityLevelChanged', networkQualityLevel => { actualNetworkQualityLevel = networkQualityLevel; });
            test.signaling.networkQualityLevel = expectedNetworkQualityLevel;
            test.signaling.emit('networkQualityLevelChanged');
            assert.equal(actualNetworkQualityLevel, expectedNetworkQualityLevel);
          });
        });
      });
    });
  });

  describe('LocalParticipantSignaling "stateChanged" events', () => {
    describe('"reconnecting"', () => {
      context('when the LocalParticipant .state is "connected"', () => {
        it('should emit "reconnecting" on the LocalParticipant', () => {
          const test = makeTest();
          let emitted;
          test.participant.once('reconnecting', () => { emitted = true; });
          test.signaling.emit('stateChanged', 'reconnecting');
          assert(emitted);
        });
      });

      context('when the LocalParticipant .state is "disconnected"', () => {
        it('should not emit "reconnecting" on the LocalParticipant', () => {
          const test = makeTest();
          let emitted;
          test.participant.once('reconnecting', () => { emitted = true; });
          test.signaling.disconnect();
          test.signaling.emit('stateChanged', 'reconnecting');
          assert(!emitted);
        });
      });
    });

    describe('"reconnected"', () => {
      context('when the LocalParticipant .state is "reconnecting"', () => {
        it('should emit "reconnected" on the LocalParticipant', () => {
          const test = makeTest({ state: 'reconnecting' });
          const reconnectingPromise = new Promise(resolve => test.participant.once('reconnected', resolve));
          test.signaling.emit('stateChanged', 'connected');
          return reconnectingPromise;
        });
      });

      context('when the LocalParticipant .state is "disconnected"', () => {
        it('should not emit "reconnected" on the LocalParticipant', () => {
          const test = makeTest({ state: 'reconnecting' });
          let emitted;
          test.participant.once('reconnected', () => { emitted = true; });
          test.signaling.disconnect();
          test.signaling.emit('stateChanged', 'connected');
          assert(!emitted);
        });
      });
    });
  });

  describe('Object.keys', () => {
    let participant;

    before(() => {
      participant = new LocalParticipant(makeSignaling(), [], { log });
    });

    it('only returns public properties', () => {
      assert.deepEqual(Object.keys(participant), [
        'audioTracks',
        'dataTracks',
        'identity',
        'networkQualityLevel',
        'networkQualityStats',
        'sid',
        'state',
        'tracks',
        'videoTracks',
        'signalingRegion'
      ]);
    });
  });

  describe('#toJSON', () => {
    let participant;

    before(() => {
      participant = new LocalParticipant(makeSignaling(), [], { log });
    });

    it('only returns public properties', () => {
      assert.deepEqual(participant.toJSON(), {
        audioTracks: {},
        dataTracks: {},
        identity: participant.identity,
        networkQualityLevel: participant.networkQualityLevel,
        networkQualityStats: participant.networkQualityStats,
        sid: participant.sid,
        signalingRegion: participant.signalingRegion,
        state: participant.state,
        tracks: {},
        videoTracks: {}
      });
    });
  });
});

function makeLocalTrackConstructors(options) {
  options = options || {};
  options.LocalAudioTrack = options.LocalAudioTrack || LocalAudioTrack;
  options.LocalDataTrack = options.LocalDataTrack || LocalDataTrack;
  options.LocalVideoTrack = options.LocalVideoTrack || LocalVideoTrack;
  return options;
}

function makeTest(options) {
  options = makeLocalTrackConstructors(options || {});
  options.MediaStreamTrack = options.MediaStreamTrack || FakeMediaStreamTrack;
  options.signaling = options.signaling || makeSignaling(options);
  options.tracks = options.tracks || [];
  options.log = log;
  options.participant = options.participant ||
    new LocalParticipant(options.signaling, options.tracks, options);
  return options;
}

function makeTrackSignaling(id) {
  const signaling = {};
  signaling.id = id;
  signaling.publishFailed = sinon.spy(() => {});
  return signaling;
}

function makeSignaling(options) {
  const signaling = new EventEmitter();
  options = options || {};
  options.state = options.state || 'connected';
  signaling.identity = options.identity || null;
  signaling.sid = options.sid || null;
  signaling.state = options.state;
  signaling.tracks = new Map();
  signaling.addTrack = sinon.spy((track, name, priority) => {
    const trackSignaling = new LocalTrackPublicationSignaling(track, name, priority);
    signaling.tracks.set(track.id, trackSignaling);
    return signaling;
  });
  signaling.disconnect = sinon.spy(() => signaling.emit('stateChanged', 'disconnected'));
  signaling.getPublication = sinon.spy(track => {
    return signaling.tracks.get(track.id);
  });
  signaling.removeTrack = sinon.spy(() => {});
  signaling.setBandwidthProfile = sinon.spy(() => {});
  signaling.setNetworkQualityConfiguration = sinon.spy(() => {});
  signaling.setParameters = sinon.spy(() => {});
  return signaling;
}

function mockPublishTrack(participant) {
  participant.publishTrack = sinon.spy(track => {
    return Promise.resolve({ track, sid: track.id });
  });
}

function mockUnpublishTrack(participant) {
  participant.unpublishTrack = sinon.spy(track => {
    return { track, sid: track.id };
  });
}
