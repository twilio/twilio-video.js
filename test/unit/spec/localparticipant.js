'use strict';

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var FakeMediaStreamTrack = require('../../lib/fakemediastream').FakeMediaStreamTrack;
var inherits = require('util').inherits;
var LocalParticipant = require('../../../lib/localparticipant');
var sinon = require('sinon');
var log = require('../../lib/fakelog');
var { a, capitalize } = require('../../lib/util');

const LocalAudioTrack = sinon.spy(function(mediaStreamTrack) {
  EventEmitter.call(this);
  if (mediaStreamTrack) {
    this.id = mediaStreamTrack.id;
    this.kind = mediaStreamTrack.kind;
    this.mediaStreamTrack = mediaStreamTrack;
  }
  this.stop = sinon.spy();
});
inherits(LocalAudioTrack, EventEmitter);

const LocalVideoTrack = sinon.spy(function(mediaStreamTrack) {
  EventEmitter.call(this);
  if (mediaStreamTrack) {
    this.id = mediaStreamTrack.id;
    this.kind = mediaStreamTrack.kind;
    this.mediaStreamTrack = mediaStreamTrack;
  }
  this.stop = sinon.spy();
});
inherits(LocalVideoTrack, EventEmitter);

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

      context('when called with a LocalTrack', () => {
        it('should not throw', () => {
          assert.doesNotThrow(() => test.participant[method](new test.LocalAudioTrack()));
          assert.doesNotThrow(() => test.participant[method](new test.LocalVideoTrack()));
        });

        it(`should call ._${method} with the given LocalTrack and return its return value`, () => {
          var localAudioTrack = new test.LocalAudioTrack();
          var ret = test.participant[method](localAudioTrack);
          delete(ret.stop);
          assert(test.participant[`_${method}`].calledWith(localAudioTrack));
          assert.deepEqual(ret, { foo: 'bar' });

          var localVideoTrack = new test.LocalVideoTrack();
          ret = test.participant[method](localVideoTrack);
          delete(ret.stop);
          assert(test.participant[`_${method}`].calledWith(localVideoTrack));
          assert.deepEqual(ret, { foo: 'bar' });
        });
      });

      context('when called with a MediaStreamTrack', () => {
        it('should not throw', () => {
          assert.doesNotThrow(() => test.participant[method](new FakeMediaStreamTrack('audio')));
          assert.doesNotThrow(() => test.participant[method](new FakeMediaStreamTrack('video')));
        });

        it(`should call ._${method} with the corresponding LocalTrack and return its return value`, () => {
          var localAudioTrack = new FakeMediaStreamTrack('audio');
          var ret = test.participant[method](localAudioTrack);
          var _methodArg = test.participant[`_${method}`].args[0][0];

          delete(ret.stop);
          assert(test.LocalAudioTrack.calledWith(localAudioTrack));
          assert(_methodArg instanceof test.LocalAudioTrack);
          assert.deepEqual(ret, { foo: 'bar' });

          var localVideoTrack = new FakeMediaStreamTrack('video');
          ret = test.participant[method](localVideoTrack);
          _methodArg = test.participant[`_${method}`].args[1][0];

          delete(ret.stop);
          assert(test.LocalVideoTrack.calledWith(localVideoTrack));
          assert(_methodArg instanceof test.LocalVideoTrack);
          assert.deepEqual(ret, { foo: 'bar' });
        });
      });

      if (method === 'removeTrack') {
        [
          [ 'when called without the "stop" argument' ],
          [ 'when called with stop=true', true ],
          [ 'when called with stop=false', false ]
        ].forEach(([ scenario, stop ]) => {
          var shouldCallStop = typeof stop === 'undefined' || stop
            ? true : false;

          context(scenario, () => {
            it(`should ${shouldCallStop ? '' : 'not'} call .stop on the LocalTrack returned by ._${method}`, () => {
              [
                test.LocalAudioTrack,
                test.LocalVideoTrack,
                FakeMediaStreamTrack.bind(null, 'audio'),
                FakeMediaStreamTrack.bind(null, 'video')
              ].forEach(LocalTrack => {
                var localTrack = new LocalTrack();
                var ret = test.participant[method](localTrack, stop);
                assert(shouldCallStop ? ret.stop.calledOnce
                  : !ret.stop.calledOnce);
              });
            });
          });
        });
      }
    });
  });

  [
    'addTracks',
    'removeTracks'
  ].forEach(method => {
    describe(`#${method}`, () => {
      var test;
      var trackMethod = method.slice(0, -1);

      beforeEach(() => {
        test = makeTest();
        test.participant[trackMethod] = sinon.spy(track => {
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
            LocalVideoTrack.bind(null, new FakeMediaStreamTrack('video'))
          ],
          [
            'MediaStreamTracks',
            FakeMediaStreamTrack.bind(null, 'audio'),
            FakeMediaStreamTrack.bind(null, 'video')
          ]
        ].forEach(([ arrayItemType, LocalAudioTrack, LocalVideoTrack ]) => {
          context(arrayItemType, () => {
            it('should not throw', () => {
              assert.doesNotThrow(() => test.participant[method]([
                new LocalAudioTrack(),
                new LocalVideoTrack()
              ]));
            });

            it(`should call .${trackMethod} for each LocalTrack`, () => {
              var localAudioTrack = new LocalAudioTrack();
              var localVideoTrack = new LocalVideoTrack();

              test.participant[method]([ localAudioTrack, localVideoTrack ]);
              sinon.assert.callCount(test.participant[trackMethod], 2);
              sinon.assert.calledWith(test.participant[trackMethod], localAudioTrack);
              sinon.assert.calledWith(test.participant[trackMethod], localVideoTrack);
            });

            it(`should return an array of the non-null return values of all the calls to .${trackMethod}`, () => {
              var localAudioTrack = new LocalAudioTrack();
              var localVideoTrack = new LocalVideoTrack();
              var ret = test.participant[method]([ localAudioTrack, localVideoTrack ]);

              assert(Array.isArray(ret));
              assert.equal(ret.length, 1);
              delete(ret[0].stop);
              assert.deepEqual(ret[0], { foo: 'bar' });
            });
          });
        });
      });

      if (method === 'removeTracks') {
        [ undefined, true, false ].forEach(stop => {
          var scenario = typeof stop === 'undefined'
            ? 'when called without the "stop" argument'
            : `when called with stop=${stop}`;

          context(scenario, () => {
            it(`should call .${trackMethod} for each item in the "tracks" argument with stop=${stop}`, () => {
              var tracks = [
                new LocalAudioTrack(new FakeMediaStreamTrack('audio')),
                new LocalVideoTrack(new FakeMediaStreamTrack('video'))
              ];

              if (typeof stop === 'undefined') {
                test.participant[method](tracks);
              } else {
                test.participant[method](tracks, stop);
              }
              sinon.assert.calledWith(test.participant[trackMethod], tracks[0], stop);
              sinon.assert.calledWith(test.participant[trackMethod], tracks[1], stop);
            });
          });
        });
      }
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
        LocalAudioTrackPublication: function(sid, id) {
          this.sid = sid;
          this.id = id;
        },
        LocalVideoTrackPublication: function(sid, id) {
          this.sid = sid;
          this.id = id;
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
      [ 'LocalTrack', kind => kind === 'audio'
        ? new LocalAudioTrack(new FakeMediaStreamTrack(kind))
        : new LocalVideoTrack(new FakeMediaStreamTrack(kind)) ],
      [ 'MediaStreamTrack', kind => new FakeMediaStreamTrack(kind) ]
    ].forEach(([ trackType, createTrack ]) => {
      [
        'audio',
        'video'
      ].forEach(kind => {
        context(`when called with ${a(kind)} ${kind} ${trackType}`, () => {
          context(`when the .trackPublications collection already has an entry for the ${trackType}'s .id`, () => {
            it('should return a Promise that is resolved with the entry from the .trackPublications', async () => {
              var localTrack = createTrack(kind);
              test.participant.trackPublications.set(localTrack.id, { foo: 'bar' });
              var localTrackPublication = await test.participant.publishTrack(localTrack);
              assert.equal(localTrackPublication, test.participant.trackPublications.get(localTrack.id));
            });
          });

          [ true, false ].forEach(hasLocalTrack => {
            context(`when the .tracks collection ${hasLocalTrack ? 'already has' : 'doesn\'t have'} an entry for the ${trackType}'s .id`, () => {
              var localTrack;
              var localTrackPublication;

              beforeEach(async () => {
                localTrack = createTrack(kind);
                if (hasLocalTrack) {
                  test.participant.tracks.set(localTrack.id, localTrack);
                }
                test.signaling.tracks.set(localTrack.id, makeTrackSignaling(localTrack.id, 'foo'));
                localTrackPublication = await test.participant.publishTrack(localTrack);
              });

              it(`should ${hasLocalTrack ? 'not' : ''} call .addTrack on the underlying ParticipantSignaling with the corresponding MediaStreamTrack`, () => {
                assert(hasLocalTrack ?
                  test.signaling.addTrack.callCount === 0 :
                  test.signaling.addTrack.args[0][0] instanceof FakeMediaStreamTrack);
              });

              context('when the SID is set for the underlying LocalTrackPublicationSignaling', () => {
                var otherKind = kind === 'audio' ? 'video' : 'audio';

                it(`should resolve the returned Promise with a ${capitalize(kind)}TrackPublication`, () => {
                  var LocalTrackPublication = options[`Local${capitalize(kind)}TrackPublication`];
                  assert(localTrackPublication instanceof LocalTrackPublication);
                  assert.equal(localTrackPublication.sid, 'foo');
                  assert.equal(localTrackPublication.id, localTrack.id);
                });

                it(`should add the ${capitalize(kind)}TrackPublication to the .trackPublications and .${kind}TrackPublications collections`, () => {
                  assert.equal(localTrackPublication, test.participant.trackPublications.get(localTrack.id));
                  assert.equal(localTrackPublication, test.participant[`${kind}TrackPublications`].get(localTrack.id));
                });

                it(`should not add the ${capitalize(kind)}TrackPublication to the .${otherKind}TrackPublications collections`, () => {
                  assert(!test.participant[`${otherKind}TrackPublications`].has(localTrack.id));
                });
              });

              context('when there is an error while setting the SID for the underlying LocalTrackPublicationSignaling', () => {
                var error;
                var localTrack2 = createTrack(kind);

                beforeEach(async () => {
                  test.signaling.tracks.set(localTrack2.id, makeTrackSignaling(localTrack2.id, 'bar', 'baz'));
                  try {
                    await test.participant.publishTrack(localTrack2);
                  } catch(_error) {
                    error = _error;
                  }
                });

                it('should reject the returned Promise with the given error', () => {
                  assert.equal(error, 'baz');
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
      ['LocalTrack', kind => kind === 'audio'
        ? new LocalAudioTrack(new FakeMediaStreamTrack(kind))
        : new LocalVideoTrack(new FakeMediaStreamTrack(kind))],
      ['MediaStreamTrack', kind => new FakeMediaStreamTrack(kind)]
    ].forEach(([trackType, createTrack]) => {
      [
        'audio',
        'video'
      ].forEach(kind => {
        var localTrack;

        context(`when the .trackPublications collection has an entry for the given ${kind} ${trackType}'s .id`, () => {
          context(`and the .tracks collection has an entry for the given ${kind} ${trackType}'s .id`, () => {
            var ret;
            var track;

            beforeEach(() => {
              localTrack = createTrack(kind);

              track = new test[`Local${capitalize(kind)}Track`](
                localTrack instanceof FakeMediaStreamTrack
                  ? localTrack : localTrack.mediaStreamTrack);

              test.signaling.tracks.set(localTrack.id, makeTrackSignaling(localTrack.id, 'foo'));
              test.participant.tracks.set(localTrack.id, track);
              test.participant[`${kind}Tracks`].set(localTrack.id, track);
              test.participant.trackPublications.set(localTrack.id, { id: localTrack.id, sid: 'foo' });
              test.participant[`${kind}TrackPublications`].set(localTrack.id, { id: localTrack.id, sid: 'foo' });
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
              assert(test.signaling.removeTrack.args[0][0] instanceof FakeMediaStreamTrack);
            });

            it(`should return the LocalTrackPublication corresponding to the unpublished ${kind} ${trackType}`, () => {
              assert.deepEqual(ret, { id: localTrack.id, sid: 'foo' });
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
                localTrack instanceof FakeMediaStreamTrack
                  ? localTrack : localTrack.mediaStreamTrack);

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
              assert(test.signaling.removeTrack.args[0][0] instanceof FakeMediaStreamTrack);
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
        it('calls .addTrack with the LocalTrack\'s LocalTrackPublicationSignaling on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'connecting' });
          var track = { id: 'foo', mediaStreamTrack: 'bar' };
          test.participant.emit('trackAdded', track);
          assert.equal(track.mediaStreamTrack, test.signaling.addTrack.args[0][0]);
        });
      });

      context('when the LocalParticipant .state is "connected"', () => {
        it('calls .addTrack with the LocalTrack\'s LocalTrackPublicationSignaling on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'connected' });
          var track = { id: 'foo', mediaStreamTrack: 'bar' };
          test.participant.emit('trackAdded', track);
          assert.equal(track.mediaStreamTrack, test.signaling.addTrack.args[0][0]);
        });
      });

      context('when the LocalParticipant .state is "disconnected"', () => {
        it('does not call .addTrack with the LocalTrack\'s LocalTrackPublicationSignaling on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'disconnected' });
          var track = { id: 'foo', mediaStreamTrack: 'bar' };
          test.participant.emit('trackAdded', track);
          assert(!test.signaling.addTrack.calledOnce);
        });
      });

      context('when the LocalParticipant .state transitions to "disconnected"', () => {
        it('does not call .addTrack with the LocalTrack\'s LocalTrackPublicationSignaling on the ParticipantSignaling', () =>{
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
        it('calls .addTrack with each LocalTrack\'s LocalTrackPublicationSignaling on the ParticipantSignaling', () =>{
          var track = new EventEmitter();
          track.id = 'foo';
          track.mediaStreamTrack = 'bar';
          var test = makeTest({
            state: 'connecting',
            tracks: [track]
          });
          assert.equal(track.mediaStreamTrack, test.signaling.addTrack.args[0][0]);
        });
      });

      context('when the LocalParticipant .state is "connected"', () => {
        it('calls .addTrack with each LocalTrack\'s LocalTrackPublicationSignaling on the ParticipantSignaling', () =>{
          var track = new EventEmitter();
          track.id = 'foo';
          track.mediaStreamTrack = 'bar';
          var test = makeTest({
            state: 'connected',
            tracks: [track]
          });
          assert.equal(track.mediaStreamTrack, test.signaling.addTrack.args[0][0]);
        });
      });

      context('when the LocalParticipant .state is "disconnected"', () => {
        it('does not call .addTrack with each LocalTrack\'s LocalTrackPublicationSignaling on the ParticipantSignaling', () =>{
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
  options.state = options.state || 'connecting';
  signaling.identity = options.identity || null;
  signaling.sid = options.sid || null;
  signaling.state = options.state;
  signaling.addTrack = sinon.spy(() => {});
  signaling.removeTrack = sinon.spy(() => {});
  signaling.setParameters = sinon.spy(() => {});
  signaling.tracks = new Map();
  return signaling;
}
