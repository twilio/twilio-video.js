'use strict';

const assert = require('assert');
const sinon = require('sinon');

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
  const mediaStreamTrack = new FakeMediaStreamTrack(kind);
  const localTrack = kind === 'data'
    ? new LocalTrack({ DataTrackSender })
    : new LocalTrack(mediaStreamTrack);

  describe(description, () => {
    describe('constructor', () => {
      context('when called without the "options" argument', () => {
        it(`should return an instance of ${description}`, () => {
          assert(new LocalTrackPublication('foo', localTrack, () => {}) instanceof LocalTrackPublication);
        });
      });

      [
        ['isTrackEnabled', kind === 'data' ? true : localTrack.isEnabled],
        ['kind', kind],
        ['track', localTrack],
        ['trackName', localTrack.name],
        ['trackSid', 'foo']
      ].forEach(([prop, expectedValue]) => {
        it(`should populate the .${prop} property`, () => {
          const localTrackPublication = new LocalTrackPublication('foo', localTrack, () => {});
          assert.equal(localTrackPublication[prop], expectedValue);
        });
      });
    });

    describe('#unpublish', () => {
      let localTrackPublication;
      let ret;
      let unpublish;

      before(() => {
        unpublish = sinon.spy();
        localTrackPublication = new LocalTrackPublication('foo', localTrack, unpublish);
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

              const localTrackPublication = new LocalTrackPublication('foo', localTrack, () => {});
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

      before(() => {
        publication = new LocalTrackPublication('foo', localTrack, () => {});
      });

      it('only returns public properties', () => {
        assert.deepEqual(Object.keys(publication), [
          'trackName',
          'trackSid',
          'isTrackEnabled',
          'kind',
          'track'
        ]);
      });
    });

    describe('#toJSON', () => {
      let publication;

      before(() => {
        publication = new LocalTrackPublication('foo', localTrack, () => {});
      });

      it('only returns public properties', () => {
        assert.deepEqual(publication.toJSON(), {
          isTrackEnabled: publication.isTrackEnabled,
          kind: publication.kind,
          track: publication.track.toJSON(),
          trackName: publication.trackName,
          trackSid: publication.trackSid
        });
      });
    });
  });
});
