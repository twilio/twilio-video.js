'use strict';

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var FakeMediaStreamTrack = require('../../lib/fakemediastream').FakeMediaStreamTrack;
var inherits = require('util').inherits;
var DataTrackSender = require('../../../lib/data/sender');
var LocalParticipant = require('../../../lib/localparticipant');
var LocalTrackPublicationSignaling = require('../../../lib/signaling/localtrackpublication');
var sinon = require('sinon');
var log = require('../../lib/fakelog');
var { a, capitalize } = require('../../lib/util');

const LocalAudioTrack = sinon.spy(function(mediaStreamTrack, options) {
  options = options || {};
  EventEmitter.call(this);
  if (mediaStreamTrack) {
    this.id = mediaStreamTrack.id;
    this.kind = mediaStreamTrack.kind;
    this.mediaStreamTrack = mediaStreamTrack;
    this.name = options.name || mediaStreamTrack.id
  }
  this.stop = sinon.spy();
});
inherits(LocalAudioTrack, EventEmitter);

const LocalVideoTrack = sinon.spy(function(mediaStreamTrack, options) {
  options = options || {};
  EventEmitter.call(this);
  if (mediaStreamTrack) {
    this.id = mediaStreamTrack.id;
    this.kind = mediaStreamTrack.kind;
    this.mediaStreamTrack = mediaStreamTrack;
    this.name = options.name || mediaStreamTrack.id
  }
  this.stop = sinon.spy();
});
inherits(LocalVideoTrack, EventEmitter);

const LocalDataTrack = sinon.spy(function(dataTrackSender, options) {
  options = options || {};
  EventEmitter.call(this);
  if (dataTrackSender) {
    this.id = dataTrackSender.id;
    this.kind = 'data';
    this.name = options.name || dataTrackSender.id;
    this._dataTrackSender = dataTrackSender;
  }
});
inherits(LocalDataTrack, EventEmitter);

describe('LocalParticipant', () => {
  describe('constructor', () => {
    context('when a room is joined', () => {
      it('should have the updated "identity" and "sid"', () => {
        // In makeTest(), test.signaling.sid and test.signaling.identity are
        // set to null, to mimic the ParticipantSignaling constructor
        var test = makeTest({ state: 'connecting' });
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
    'addTrack',
    'removeTrack'
  ].forEach(method => {
    describe(`#${method}`, () => {
      var test;

      beforeEach(() => {
        test = makeTest();
        test.participant[`_${method}`] = sinon.spy(() => ({ foo: 'bar', stop: sinon.spy() }));
      });

      context('when called with an invalid argument', () => {
        it('should throw', () => {
          assert.throws(() => test.participant[method]('invalid track argument'));
        });

        it(`should not call ._${method}`, () => {
          try {
            test.participant[method]('invalid track argument');
          } catch (e) {
            assert(!test.participant[`_${method}`].calledOnce);
          }
        });
      });

      ['Audio', 'Video', 'Data'].forEach(kind => {
        context(`when called with a Local${kind}Track`, () => {
          it('should not throw', () => {
            assert.doesNotThrow(() => test.participant[method](new test[`Local${kind}Track`]()));
          });
        });
      });

      context('when called with a MediaStreamTrack', () => {
        it('should not throw', () => {
          assert.doesNotThrow(() => test.participant[method](new FakeMediaStreamTrack('audio')));
          assert.doesNotThrow(() => test.participant[method](new FakeMediaStreamTrack('video')));
        });
      });
    });
  });

  [
    'addTracks',
    'publishTracks',
    'removeTracks',
    'unpublishTracks',
  ].forEach(method => {
    describe(`#${method}`, () => {
      var test;
      var trackMethod = method.slice(0, -1);

      beforeEach(() => {
        test = makeTest();
        test.participant[trackMethod] = sinon.spy(track => {
          if (trackMethod.startsWith('publish')) {
            // TODO(mroberts): Here is a very bare-bones "mock"
            // LocalTrackPublication. We should improve this later.
            return { track, sid: track.id };
          }
          return track.kind === 'audio' ? null : { foo: 'bar', stop: sinon.spy() };
        });
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
        ].forEach(([ arrayItemType, LocalAudioTrack, LocalVideoTrack, LocalDataTrack ]) => {
          context(arrayItemType, () => {
            it('should not throw', () => {
              assert.doesNotThrow(() => test.participant[method]([
                new LocalAudioTrack(),
                new LocalVideoTrack(),
                new LocalDataTrack()
              ]));
            });

            if (method === 'publishTracks') {
              it(`should return a Promise for an array of LocalTrackPublications`, async () => {
                var localAudioTrack = new LocalAudioTrack();
                var localVideoTrack = new LocalVideoTrack();
                var localDataTrack = new LocalDataTrack();
                var ret = await test.participant[method]([ localAudioTrack, localVideoTrack, localDataTrack ]);

                assert(Array.isArray(ret));
                assert.equal(ret.length, 3);
                assert.equal(ret[0].track, localAudioTrack);
                assert.equal(ret[1].track, localVideoTrack);
                assert.equal(ret[2].track, localDataTrack);
              });
            }
          });
        });
      });
    });
  });

  describe('#setParameters', () => {
    var test;

    context('when the EncodingParameters is', () => {
      [
        ['foo', 'not an object'],
        [{maxAudioBitrate: 'bar', maxVideoBitrate: 1000}, 'an object that has .maxAudioBitrate which is not a number'],
        [{maxAudioBitrate: 1000, maxVideoBitrate: false}, 'an object that has .maxVideoBitrate which is not a number'],
        [{maxAudioBitrate: 'foo', maxVideoBitrate: true}, 'an object which has both .maxAudioBitrate and .maxVideoBitrate which are not numbers']
      ].forEach(([encodingParameters, scenario]) => {
        context(scenario, () => itShould(encodingParameters, true));
      });

      [
        [undefined, 'undefined'],
        [null, 'null'],
        [{}, 'an object which does not have .maxAudioBitrate and .maxVideoBitrate'],
        [{maxAudioBitrate: null, maxVideoBitrate: null}, 'an object where both .maxAudioBitrate and .maxVideoBitrate are null'],
        [{maxVideoBitrate: 1000}, 'an object that does not have .maxAudioBitrate'],
        [{maxAudioBitrate: null, maxVideoBitrate: 1000}, 'an object where .maxAudioBitrate is null'],
        [{maxAudioBitrate: 1000}, 'an object that does not have .maxVideoBitrate'],
        [{maxAudioBitrate: 1000, maxVideoBitrate: null}, 'an object where .maxVideoBitrate is null'],
        [{maxAudioBitrate: 1000, maxVideoBitrate: 2000}, 'an object which has both .maxAudioBitrate and .maxVideoBitrate which are numbers']
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
        !throwAndFail && sinon.assert.calledWith(test.signaling.setParameters,
          encodingParameters === null ? {maxAudioBitrate: null, maxVideoBitrate: null} : encodingParameters);
      });
    }
  });

  describe('#publishTrack', () => {
    var options;
    var test;

    beforeEach(() => {
      options = {
        LocalAudioTrackPublication: function(sid, track) {
          this.trackName = track.name;
          this.trackSid = sid;
          this.track = track;
        },
        LocalVideoTrackPublication: function(sid, track) {
          this.trackName = track.name;
          this.trackSid = sid;
          this.track = track;
        },
        LocalDataTrackPublication: function(sid, track) {
          this.trackName = track.name;
          this.trackSid = sid;
          this.track = track;
        }
      };
      test = makeTest(options);
    });

    context('when called with an invalid argument', () => {
      [
        [
          'should return a rejected Promise with a TypeError',
          (error, addTrack) => error instanceof TypeError
        ],
        [
          'should not call .addTrack on the underlying ParticipantSignaling',
          (error, addTrack) => addTrack.callCount === 0
        ]
      ].forEach(([ expectation, assertion ]) => {
        it(`${expectation}`, async () => {
          try {
            await test.participant.publishTrack('invalid track argument');
          } catch(error) {
            assert(assertion(error, test.signaling.addTrack));
            return;
          }
          throw new Error('Unexpected resolution');
        });
      });
    });

    [
      [
        'LocalTrack',
        ['audio', 'video', 'data'],
        kind => ({
          audio: new LocalAudioTrack(new FakeMediaStreamTrack(kind)),
          video: new LocalVideoTrack(new FakeMediaStreamTrack(kind)),
          data: new LocalDataTrack(new DataTrackSender(null, null, true))
        }[kind])
      ],
      [
        'MediaStreamTrack',
        ['audio', 'video'],
        kind => ({
          audio: new FakeMediaStreamTrack(kind),
          video: new FakeMediaStreamTrack(kind)
        }[kind])
      ]
    ].forEach(([ trackType, kinds, createTrack ]) => {
      kinds.forEach(kind => {
        context(`when called with ${a(kind)} ${kind} ${trackType}`, () => {
          context(`when the .trackPublications collection already has an entry for the ${trackType}`, () => {
            [true, false].forEach(isConnected => {
              context(`and the LocalParticipant\'s ParticipantSignaling is in the "${isConnected ? 'connected' : 'connecting'}" state`, () => {
                let localTrack;

                beforeEach(async () => {
                  localTrack = createTrack(kind);
                  const promise = test.participant.publishTrack(localTrack);
                  const trackSignaling = test.participant._signaling.tracks.get(localTrack.id);
                  trackSignaling.setSid('foo');
                  await promise;
                  await new Promise(resolve => test.participant.on('trackPublished', resolve));
                });

                it('should return a Promise that is resolved with the entry from the .trackPublications', async () => {
                  const localTrackPublication = await test.participant.publishTrack(localTrack);
                  assert.equal(localTrackPublication, test.participant.trackPublications.get('foo'));
                });

                it('should not raise a "trackPublished" event', async () => {
                  let trackPublishedEvent;
                  test.participant.on('trackPublished', () => trackPublishedEvent = true);
                  const localTrackPublication = await test.participant.publishTrack(localTrack);
                  assert(!trackPublishedEvent);
                });
              });

              [ true, false ].forEach(hasLocalTrack => {
                context(`when the .tracks collection ${hasLocalTrack ? 'already has' : 'doesn\'t have'} an entry for the ${trackType}'s .id`, () => {
                  let localTrack;
                  let localTrackPublication;
                  let trackPublishedEvent;

                  beforeEach(async () => {
                    test.signaling.state = isConnected ? 'connected' : 'connecting';
                    localTrack = createTrack(kind);
                    if (hasLocalTrack) {
                      test.participant.publishTrack(localTrack);
                      test.signaling.addTrack.reset();
                    }
                    const promise = trackType === 'LocalTrack'
                      ? test.participant.publishTrack(localTrack)
                      : test.participant.publishTrack(localTrack, { name: 'bar' });
                    test.participant._signaling.tracks.get(localTrack.id).setSid('foo');
                    localTrackPublication = await promise;
                    trackPublishedEvent = null;
                    test.participant.on('trackPublished', publication => trackPublishedEvent = publication);
                    await new Promise(resolve => setTimeout(resolve));
                  });

                  it(`should ${hasLocalTrack ? 'not ' : ''}call .addTrack on the underlying ParticipantSignaling with the corresponding MediaStreamTrack and LocalTrack name`, () => {
                    if (hasLocalTrack) {
                      sinon.assert.notCalled(test.signaling.addTrack);
                      return;
                    }
                    sinon.assert.calledOnce(test.signaling.addTrack);
                    assert(test.signaling.addTrack.args[0][0] instanceof FakeMediaStreamTrack
                      || test.signaling.addTrack.args[0][0] instanceof DataTrackSender);
                    assert.equal(test.signaling.addTrack.args[0][1], (hasLocalTrack || trackType === 'LocalTrack') ? localTrack.id : 'bar');
                  });

                  context('when the SID is set for the underlying LocalTrackPublicationSignaling', () => {
                    var otherKinds = {
                      audio: ['video', 'data'],
                      video: ['audio', 'data'],
                      data: ['audio', 'video']
                    }[kind];

                    it(`should resolve the returned Promise with a ${capitalize(kind)}TrackPublication`, () => {
                      var LocalTrackPublication = options[`Local${capitalize(kind)}TrackPublication`];
                      assert(localTrackPublication instanceof LocalTrackPublication);
                      assert.equal(localTrackPublication.trackName, (hasLocalTrack || trackType === 'LocalTrack') ? localTrack.id : 'bar');
                      assert.equal(localTrackPublication.trackSid, 'foo');
                      assert.equal(localTrackPublication.track.id, localTrack.id);
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

                    it(`should add the ${capitalize(kind)}TrackPublication to the .trackPublications and .${kind}TrackPublications collections`, () => {
                      assert.equal(localTrackPublication, test.participant.trackPublications.get(localTrackPublication.trackSid));
                      assert.equal(localTrackPublication, test.participant[`${kind}TrackPublications`].get(localTrackPublication.trackSid));
                    });

                    otherKinds.forEach(otherKind => {
                      it(`should not add the ${capitalize(kind)}TrackPublication to the .${otherKind}TrackPublications collection`, () => {
                        assert(!test.participant[`${otherKind}TrackPublications`].has(localTrack.id));
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
                      localTrack2 = createTrack(kind);
                      const promise = test.participant.publishTrack(localTrack2);
                      const localTrackSignaling = test.participant._signaling.tracks.get(localTrack2.id);
                      localTrackSignaling.publishFailed(expectedError);
                      try {
                        await promise;
                      } catch(error) {
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

                    it(`should not add the Local${capitalize(kind)}Track to the .tracks collection`, () => {
                      assert(!test.participant.tracks.has(localTrack2.id));
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  describe('#unpublishTrack', () => {
    var test;

    beforeEach(() => {
      test = makeTest();
    });

    context('when called with an invalid argument', () => {
      [
        [
          'should throw a TypeError',
          (error, removeTrack) => error instanceof TypeError
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
        var localTrack;

        context(`when the .trackPublications collection has an entry for the given ${kind} ${trackType}`, () => {
          context(`and the .tracks collection has an entry for the given ${kind} ${trackType}'s .id`, () => {
            var ret;
            var track;

            beforeEach(() => {
              localTrack = createTrack(kind);

              track = new test[`Local${capitalize(kind)}Track`](
                (localTrack instanceof FakeMediaStreamTrack || localTrack instanceof DataTrackSender)
                  ? localTrack : (localTrack.mediaStreamTrack || localTrack._dataTrackSender));

              test.signaling.tracks.set(localTrack.id, makeTrackSignaling(localTrack.id, 'foo'));
              test.participant.tracks.set(localTrack.id, track);
              test.participant[`${kind}Tracks`].set(localTrack.id, track);
              test.participant.trackPublications.set('foo', { track, sid: 'foo' });
              test.participant[`${kind}TrackPublications`].set('foo', { track, sid: 'foo' });
              ret = test.participant.unpublishTrack(localTrack);
            });

            it(`should remove the ${kind} ${trackType} from the .tracks and .${kind}Tracks collections`, () => {
              assert(!test.participant.tracks.has(localTrack.id));
              assert(!test.participant[`${kind}Tracks`].has(localTrack.id));
            });

            it(`should remove the ${kind} ${trackType}'s entry from the .trackPublications and .${kind}TrackPublications collections`, () => {
              assert(!test.participant.trackPublications.has(localTrack.id));
              assert(!test.participant[`${kind}TrackPublications`].has(localTrack.id));
            });

            it('should call .removeTrack on the underlying ParticipantSignaling with the corresponding MediaStreamTrack', () => {
              assert(test.signaling.removeTrack.args[0][0] instanceof FakeMediaStreamTrack
                || test.signaling.removeTrack.args[0][0] instanceof DataTrackSender);
            });

            it(`should return the LocalTrackPublication corresponding to the unpublished ${kind} ${trackType}`, () => {
              assert.equal(ret.sid, 'foo');
              assert.equal(ret.track.id, localTrack.id);
            });
          });
        });

        context(`when the .trackPublications collection does not have an entry for the given ${kind} ${trackType}'s ID`, () => {
          context(`and the .tracks collection has the given ${kind} ${trackType}`, () => {
            var ret;
            var track;
            var trackSignaling;

            beforeEach(() => {
              localTrack = createTrack(kind);

              track = new test[`Local${capitalize(kind)}Track`](
                (localTrack instanceof FakeMediaStreamTrack || localTrack instanceof DataTrackSender)
                  ? localTrack : (localTrack.mediaStreamTrack || localTrack._dataTrackSender));

              trackSignaling = makeTrackSignaling(localTrack.id, 'foo');
              test.signaling.tracks.set(localTrack.id, trackSignaling);
              test.participant.tracks.set(localTrack.id, track);
              test.participant[`${kind}Tracks`].set(localTrack.id, track);
              ret = test.participant.unpublishTrack(localTrack);
            });

            it(`should remove the ${kind} ${trackType} from the .tracks and .${kind}Tracks collections`, () => {
              assert(!test.participant.tracks.has(localTrack.id));
              assert(!test.participant[`${kind}Tracks`].has(localTrack.id));
            });

            it('should reject the pending Promise returned by the previous call to LocalParticipant#publishTrack', () => {
              assert(trackSignaling.publishFailed.args[0][0] instanceof Error);
            });

            it(`should call .removeTrack on the underlying ParticipantSignaling with the corresponding MediaStreamTrack`, () => {
              assert(test.signaling.removeTrack.args[0][0] instanceof FakeMediaStreamTrack
                || test.signaling.removeTrack.args[0][0] instanceof DataTrackSender);
            });

            it('should return null', () => {
              assert.equal(ret, null);
            });
          });

          context(`and the .tracks collection does not have the given ${kind} ${trackType}`, () => {
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
    context('"trackAdded" event', () => {
      context('when the LocalParticipant .state is "connecting"', () => {
        it('calls .addTrack with the LocalTrack\'s MediaStreamTrack and name on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'connecting' });
          var track = { id: 'foo', mediaStreamTrack: 'bar', name: 'baz' };
          test.participant.emit('trackAdded', track);
          assert.equal(track.mediaStreamTrack, test.signaling.addTrack.args[0][0]);
          assert.equal(track.name, test.signaling.addTrack.args[0][1]);
        });
      });

      context('when the LocalParticipant .state is "connected"', () => {
        it('calls .addTrack with the LocalTrack\'s MediaStreamTrack and name on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'connected' });
          var track = { id: 'foo', mediaStreamTrack: 'bar', name: 'baz' };
          test.participant.emit('trackAdded', track);
          assert.equal(track.mediaStreamTrack, test.signaling.addTrack.args[0][0]);
          assert.equal(track.name, test.signaling.addTrack.args[0][1]);
        });
      });

      context('when the LocalParticipant .state is "disconnected"', () => {
        it('does not call .addTrack with the LocalTrack\'s MediaStreamTrack and name on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'disconnected' });
          var track = { id: 'foo', mediaStreamTrack: 'bar' };
          test.participant.emit('trackAdded', track);
          assert(!test.signaling.addTrack.calledOnce);
        });
      });

      context('when the LocalParticipant .state transitions to "disconnected"', () => {
        it('does not call .addTrack with the LocalTrack\'s MediaStreamTrack and name on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'connected' });
          test.signaling.emit('stateChanged', 'disconnected');
          var track = { id: 'foo', mediaStreamTrack: 'bar' };
          test.participant.emit('trackAdded', track);
          assert(!test.signaling.addTrack.calledOnce);
        });
      });
    });

    [ 'disable', 'enable' ].forEach(trackMethod => {
      context(`"track${capitalize(trackMethod)}d" event`, () => {
        [ 'connecting', 'connected' ].forEach(state => {
          context(`when the LocalParticipant .state is "${state}"`, () => {
            it(`should call .${trackMethod} on the LocalTrack\'s LocalTrackPublicationSignaling`, () => {
              var test = makeTest({ state });
              var track = { id: 'foo', mediaStreamTrack: 'bar' };
              var trackSignaling = { id: 'foo' , [trackMethod]: sinon.spy() };
              test.signaling.tracks = { get: () => trackSignaling };
              test.participant.emit(`track${capitalize(trackMethod)}d`, track);
              sinon.assert.calledOnce(trackSignaling[trackMethod]);
            });
          });
        });

        [ 'is', 'transitions to' ].forEach(action => {
          context(`when the LocalParticipant .state ${action} "disconnected"`, () => {
            it(`should not call .${trackMethod} on the LocalTrack\'s LocalTrackPublicationSignaling`, () => {
              var test = makeTest({ state: action === 'is' ? 'disconnected' : 'connected' });
              var track = { id: 'foo', mediaStreamTrack: 'bar' };
              var trackSignaling = { id: 'foo' , [trackMethod]: sinon.spy() };

              test.signaling.tracks = { get: () => trackSignaling };
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

    context('"trackRemoved" event', () => {
      context('when the LocalParticipant .state is "connecting"', () => {
        it('calls .removeTrack with the LocalTrack\'s LocalTrackPublicationSignaling on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'connecting' });
          var track = { id: 'foo', mediaStreamTrack: 'bar' };
          test.participant.emit('trackRemoved', track);
          assert.equal(track.mediaStreamTrack, test.signaling.removeTrack.args[0][0]);
        });
      });

      context('when the LocalParticipant .state is "connected"', () => {
        it('calls .removeTrack with the LocalTrack\'s LocalTrackPublicationSignaling on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'connected' });
          var track = { id: 'foo', mediaStreamTrack: 'bar' };
          test.participant.emit('trackRemoved', track);
          assert.equal(track.mediaStreamTrack, test.signaling.removeTrack.args[0][0]);
        });
      });

      context('when the LocalParticipant .state is "disconnected"', () => {
        it('does not call .removeTrack with the LocalTrack\'s LocalTrackPublicationSignaling on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'disconnected' });
          var track = { id: 'foo', mediaStreamTrack: 'bar' };
          test.participant.emit('trackRemoved', track);
          assert(!test.signaling.removeTrack.calledOnce);
        });
      });

      context('when the LocalParticipant .state transitions to "disconnected"', () => {
        it('does not call .removeTrack with the LocalTrack\'s LocalTrackPublicationSignaling on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'connected' });
          test.signaling.emit('stateChanged', 'disconnected');
          var track = { id: 'foo', mediaStreamTrack: 'bar' };
          test.participant.emit('trackRemoved', track);
          assert(!test.signaling.removeTrack.calledOnce);
        });
      });
    });

    context('"trackStopped" event', () => {
      context('when the LocalParticipant .state begins in "connecting"', () => {
        context('and a LocalTrack emits "stopped"', () => {
          it('emits "trackStopped"', () => {
            var track = new EventEmitter();
            track.mediaStreamTrack = track;
            var trackStopped;
            var test = makeTest({ tracks: [ track ] });
            test.participant.once('trackStopped', track => trackStopped = track);
            track.emit('stopped', track);
            assert.equal(track, trackStopped);
          });
        });
      });

      context('when the LocalParticipant .state transitions to "disconnected"', () => {
        context('and a LocalTrack emits "stopped"', () => {
          it('does not emit "trackStopped"', () => {
            var track = new EventEmitter();
            track.mediaStreamTrack = track;
            var trackStopped;
            var test = makeTest({ tracks: [ track ] });
            test.signaling.emit('stateChanged', 'disconnected');
            test.participant.once('trackStopped', track => trackStopped = track);
            track.emit('stopped', track);
            assert(!trackStopped);
          });
        });
      });

      context('when the LocalParticipant .state begins in "disconnected"', () => {
        context('and a LocalTrack emits "stopped"', () => {
          it('does not emit "trackStopped"', () => {
            var track = new EventEmitter();
            var trackStopped;
            var test = makeTest({ tracks: [ track ], state: 'disconnected' });
            test.participant.once('trackStopped', track => trackStopped = track);
            track.emit('stopped', track);
            assert(!trackStopped);
          });
        });
      });
    });

    context('.tracks', () => {
      context('when the LocalParticipant .state is "connecting"', () => {
        it('calls .addTrack with each LocalTrack\'s MediaStreamTrack and name on the ParticipantSignaling', () =>{
          var track = new EventEmitter();
          track.id = 'foo';
          track.mediaStreamTrack = 'bar';
          track.name = 'baz';
          var test = makeTest({
            state: 'connecting',
            tracks: [track]
          });
          assert.equal(track.mediaStreamTrack, test.signaling.addTrack.args[0][0]);
          assert.equal(track.name, test.signaling.addTrack.args[0][1]);
        });
      });

      context('when the LocalParticipant .state is "connected"', () => {
        it('calls .addTrack with each LocalTrack\'s MediaStreamTrack and name on the ParticipantSignaling', () =>{
          var track = new EventEmitter();
          track.id = 'foo';
          track.mediaStreamTrack = 'bar';
          track.name = 'baz';
          var test = makeTest({
            state: 'connected',
            tracks: [track]
          });
          assert.equal(track.mediaStreamTrack, test.signaling.addTrack.args[0][0]);
          assert.equal(track.name, test.signaling.addTrack.args[0][1]);
        });
      });

      context('when the LocalParticipant .state is "disconnected"', () => {
        it('does not call .addTrack with each LocalTrack\'s MediaStreamTrack and name on the ParticipantSignaling', () =>{
          var track = new EventEmitter();
          track.id = 'foo';
          track.mediaStreamTrack = 'bar';
          var test = makeTest({
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
          var test = makeTest({ state: 'connecting' });
          var stateChanged;
          test.participant.once('foo', participant => stateChanged = participant);
          test.signaling.emit('stateChanged', 'foo');
          assert.equal(
            test.participant,
            stateChanged);
        });
      });

      context('when the LocalParticipant .state is "connected"', () => {
        it('re-emits "stateChanged" event states', () => {
          var test = makeTest({ state: 'connected' });
          var stateChanged;
          test.participant.once('foo', participant => stateChanged = participant);
          test.signaling.emit('stateChanged', 'foo');
          assert.equal(
            test.participant,
            stateChanged);
        });
      });

      context('when the LocalParticipant .state is "disconnected"', () => {
        it('does not re-emit "stateChanged" event states', () => {
          var test = makeTest({ state: 'disconnected' });
          var stateChanged = false;
          test.participant.once('foo', () => stateChanged = true);
          test.signaling.emit('stateChanged', 'foo');
          assert(!stateChanged);
        });
      });

      context('when the LocalParticipant .state transitions to "disconnected"', () => {
        let test;
        let tracks1;
        let tracks2;

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

            tracks2.forEach(track => test.participant.addTrack(track));

            test.signaling.emit('stateChanged', 'disconnected');
          });

          it('stops any LocalTracks passed at construction', () => {
            tracks1.forEach(track => sinon.assert.calledOnce(track.stop));
          });

          it('does not stop any LocalTracks added after construction', () => {
            tracks2.forEach(track => sinon.assert.notCalled(track.stop));
          });
        });

        context('and shouldStopLocalTracks is false', () => {
          beforeEach(() => {
            test = makeTest({
              LocalAudioTrack,
              LocalVideoTrack,
              shouldStopLocalTracks: true,
              state: 'connected',
              tracks: tracks1
            });

            tracks2.forEach(track => test.participant.addTrack(track));

            test.signaling.emit('stateChanged', 'disconnected');
          });

          it('does not stop any LocalTracks passed at construction', () => {
            tracks1.forEach(track => sinon.assert.calledOnce(track.stop));
          });

          it('does not stop any LocalTracks added after construction', () => {
            tracks2.forEach(track => sinon.assert.notCalled(track.stop));
          });
        });

        it('does not re-emit "stateChanged" event states', () => {
          var test = makeTest({ state: 'connected' });
          test.signaling.emit('stateChanged', 'disconnected');
          var stateChanged = false;
          test.participant.once('foo', () => stateChanged = true);
          test.signaling.emit('stateChanged', 'foo');
          assert(!stateChanged);
        });
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

function makeTrackSignaling(id, sid, getSidError) {
  var signaling = {};
  signaling.id = id;
  signaling.getSid = sinon.spy(() => getSidError
    ? Promise.reject(getSidError)
    : Promise.resolve(sid));
  signaling.publishFailed = sinon.spy(() => {});
  return signaling;
}

function makeSignaling(options) {
  var signaling = new EventEmitter();
  options = options || {};
  options.state = options.state || 'connected';
  signaling.identity = options.identity || null;
  signaling.sid = options.sid || null;
  signaling.state = options.state;
  signaling.tracks = new Map();
  signaling.addTrack = sinon.spy(track => {
    const trackSignaling = new LocalTrackPublicationSignaling(track);
    signaling.tracks.set(track.id, trackSignaling);
    return signaling;
  });
  signaling.removeTrack = sinon.spy(() => {});
  signaling.setParameters = sinon.spy(() => {});
  signaling.tracks = new Map();
  return signaling;
}
