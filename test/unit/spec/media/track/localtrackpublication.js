'use strict';

const { EventEmitter } = require('events');
const { inherits } = require('util');
const assert = require('assert');
const sinon = require('sinon');

const { trackPriority } = require('../../../../../lib/util/constants');
const DataTrackSender = require('../../../../../lib/data/sender');
const LocalAudioTrack = require('../../../../../lib/media/track/localaudiotrack');
const LocalAudioTrackPublication = require('../../../../../lib/media/track/localaudiotrackpublication');
const LocalDataTrack = require('../../../../../lib/media/track/localdatatrack');
const LocalDataTrackPublication = require('../../../../../lib/media/track/localdatatrackpublication');
const LocalVideoTrack = require('../../../../../lib/media/track/localvideotrack');
const LocalVideoTrackPublication = require('../../../../../lib/media/track/localvideotrackpublication');

const { FakeMediaStreamTrack } = require('../../../../lib/fakemediastream');

[
  ['LocalAudioTrackPublication', LocalAudioTrackPublication, LocalAudioTrack],
  ['LocalVideoTrackPublication', LocalVideoTrackPublication, LocalVideoTrack],
  ['LocalDataTrackPublication', LocalDataTrackPublication, LocalDataTrack]
].forEach(([description, LocalTrackPublication, LocalTrack]) => {
  const kind = {
    LocalAudioTrackPublication: 'audio',
    LocalVideoTrackPublication: 'video',
    LocalDataTrackPublication: 'data'
  }[description];

  let localTrack;
  let mediaStreamTrack;

  describe(description, () => {
    beforeEach(() => {
      mediaStreamTrack = new FakeMediaStreamTrack(kind);
      localTrack = kind === 'data'
        ? new LocalTrack({ DataTrackSender })
        : new LocalTrack(mediaStreamTrack);
    });

    describe('constructor', () => {
      context('when called without the "options" argument', () => {
        it(`should return an instance of ${description}`, () => {
          const localTrackPublication = new LocalTrackPublication(makeLocalTrackPublicationSignaling('foo', 'bar'), localTrack, () => {});
          assert(localTrackPublication instanceof LocalTrackPublication);
        });
      });

      [
        ['isTrackEnabled', kind === 'data' ? () => true : () => localTrack.isEnabled],
        ['kind', () => kind],
        ['priority', () => 'bar'],
        ['track', () => localTrack],
        ['trackName', () => localTrack.name],
        ['trackSid', () => 'foo']
      ].forEach(([prop, getExpectedValue]) => {
        it(`should populate the .${prop} property`, () => {
          const localTrackPublication = new LocalTrackPublication(makeLocalTrackPublicationSignaling('foo', 'bar'), localTrack, () => {});
          assert.equal(localTrackPublication[prop], getExpectedValue());
        });
      });
    });

    describe('#setPriority', () => {
      [2, 'baz'].forEach(priority => {
        context(`when called with a TrackPriority that is ${typeof priority === 'string' ? 'invalid' : 'not a string'}`, () => {
          it('should throw with a RangeError', () => {
            const localTrackPublicationSignaling = makeLocalTrackPublicationSignaling('foo', 'bar');
            const localTrackPublication = new LocalTrackPublication(localTrackPublicationSignaling, localTrack, () => {});
            let error = null;
            try {
              localTrackPublication.setPriority(priority);
            } catch (error_) {
              error = error_;
            } finally {
              assert(error instanceof RangeError);
              sinon.assert.notCalled(localTrackPublicationSignaling.setPriority);
            }
          });
        });
      });

      Object.values(trackPriority).forEach(priority => {
        context(`when called with a TrackPriority "${priority}"`, () => {
          it('should return the LocalTrackPublication', () => {
            const localTrackPublication = new LocalTrackPublication(makeLocalTrackPublicationSignaling('foo', 'bar'), localTrack, () => {});
            assert.equal(localTrackPublication.setPriority(priority), localTrackPublication);
          });

          it('should call .setPriority on the underlying LocalTrackPublicationV2', () => {
            const localTrackPublicationSignaling = makeLocalTrackPublicationSignaling('foo', 'bar');
            const localTrackPublication = new LocalTrackPublication(localTrackPublicationSignaling, localTrack, () => {});
            localTrackPublication.setPriority(priority);
            sinon.assert.calledWith(localTrackPublicationSignaling.setPriority, priority);
          });
        });
      });
    });

    describe('#unpublish', () => {
      let localTrackPublication;
      let ret;
      let unpublish;

      beforeEach(() => {
        unpublish = sinon.spy();
        localTrackPublication = new LocalTrackPublication(makeLocalTrackPublicationSignaling('foo', 'bar'), localTrack, unpublish);
        ret = localTrackPublication.unpublish();
      });

      it('should call the unpublish callback (with the LocalTrackPublication) that is passed to the constructor', () => {
        sinon.assert.calledWith(unpublish, localTrackPublication);
      });

      it('should return the LocalTrackPublication', () => {
        assert.equal(ret, localTrackPublication);
      });
    });

    if (kind !== 'data') {
      describe('events', () => {
        context('when "warning" is emitted on the signaling object', () => {
          it(`should emit "warning" on the ${description}`, () => {
            const signaling = makeLocalTrackPublicationSignaling('foo', 'bar');
            const localTrackPublication = new LocalTrackPublication(signaling, localTrack, () => {});
            const handler = sinon.stub();
            const param = { foo: 'foo', bar: 'bar' };

            localTrackPublication.on('warning', handler);
            signaling.emit('warning', param);
            sinon.assert.calledOnce(handler);
            sinon.assert.calledWithExactly(handler, param);
          });
        });

        context('when "warningsCleared" is emitted on the signaling object', () => {
          it(`should emit "warningsCleared" on the ${description}`, () => {
            const signaling = makeLocalTrackPublicationSignaling('foo', 'bar');
            const localTrackPublication = new LocalTrackPublication(signaling, localTrack, () => {});
            const handler = sinon.stub();

            localTrackPublication.on('warningsCleared', handler);
            signaling.emit('warning');
            sinon.assert.calledOnce(handler);
          });
        });

        ['trackDisabled', 'trackEnabled'].forEach(event => {
          const trackEvent = {
            trackDisabled: 'disabled',
            trackEnabled: 'enabled'
          }[event];

          context(`when "${trackEvent}" is emitted on the LocalTrack`, () => {
            it(`should emit "${event}" on the ${description}`, () => {
              localTrack.enable({
                trackDisabled: true,
                trackEnabled: false
              }[event]);

              const localTrackPublication = new LocalTrackPublication(makeLocalTrackPublicationSignaling('foo', 'bar'), localTrack, () => {});
              let localTrackPublicationEvent = false;

              localTrackPublication.once(event, () => {
                localTrackPublicationEvent = true;
              });

              localTrack.enable({
                trackDisabled: false,
                trackEnabled: true
              }[event]);

              assert(localTrackPublicationEvent);
            });
          });
        });
      });
    }

    describe('Object.keys', () => {
      let publication;

      beforeEach(() => {
        publication = new LocalTrackPublication(makeLocalTrackPublicationSignaling('foo', 'bar'), localTrack, () => {});
      });

      it('only returns public properties', () => {
        assert.deepEqual(Object.keys(publication), [
          'trackName',
          'trackSid',
          'isTrackEnabled',
          'kind',
          'priority',
          'track'
        ]);
      });
    });

    describe('#toJSON', () => {
      let publication;

      beforeEach(() => {
        publication = new LocalTrackPublication(makeLocalTrackPublicationSignaling('foo', 'bar'), localTrack, () => {});
      });

      it('only returns public properties', () => {
        assert.deepEqual(publication.toJSON(), {
          isTrackEnabled: publication.isTrackEnabled,
          kind: publication.kind,
          priority: publication.priority,
          track: publication.track.toJSON(),
          trackName: publication.trackName,
          trackSid: publication.trackSid
        });
      });
    });
  });
});

function makeLocalTrackPublicationSignaling(sid, priority) {
  function TrackPublicationSignaling() {
    this.sid = sid;
    this.priority = priority;
    this.updatedPriority = priority;
    this.setPriority = sinon.spy();
  }
  inherits(TrackPublicationSignaling, EventEmitter);
  return new TrackPublicationSignaling();
}
