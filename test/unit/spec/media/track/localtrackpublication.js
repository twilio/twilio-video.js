'use strict';

const assert = require('assert');
const DataTrackSender = require('../../../../../lib/data/sender');
const LocalAudioTrackPublication = require('../../../../../lib/media/track/localaudiotrackpublication');
const LocalVideoTrackPublication = require('../../../../../lib/media/track/localvideotrackpublication');
const LocalDataTrackPublication = require('../../../../../lib/media/track/localdatatrackpublication');
const { FakeMediaStreamTrack } = require('../../../../lib/fakemediastream');
const sinon = require('sinon');

[
  ['LocalAudioTrackPublication', LocalAudioTrackPublication],
  ['LocalVideoTrackPublication', LocalVideoTrackPublication],
  ['LocalDataTrackPublication', LocalDataTrackPublication]
].forEach(pair => {
  const description = pair[0];
  const LocalTrackPublication = pair[1];
  const kind = {
    LocalAudioTrackPublication: 'audio',
    LocalVideoTrackPublication: 'video',
    LocalDataTrackPublication: 'data'
  }[description];
  const track = kind === 'data' ? new DataTrackSender() : new FakeMediaStreamTrack(kind);

  describe(description, function() {
    describe('constructor', () => {
      context('when called without the "options" argument', () => {
        [
          [
            'when called without the "new" keyword',
            () => LocalTrackPublication('foo', track, () => {})
          ],
          [
            'when called with the "new" keyword',
            () => new LocalTrackPublication('bar', track, () => {})
          ]
        ].forEach(([ scenario, createLocalTrackPublication ]) => {
          context(scenario, () => {
            it('should not throw', () => {
              assert.doesNotThrow(createLocalTrackPublication);
            });

            it(`should return an instance of ${description}`, () => {
              assert(createLocalTrackPublication() instanceof LocalTrackPublication);
            });
          });
        });
      });

      it('should populate the .track property', () => {
        var localTrackPublication = new LocalTrackPublication('foo', track, () => {});
        assert.equal(localTrackPublication.track, track);
      });

      it('should populate the .kind property', () => {
        var localTrackPublication = new LocalTrackPublication('foo', track, () => {});
        assert.equal(localTrackPublication.kind, kind);
      });

      it('should populate the .sid property', () => {
        var localTrackPublication = new LocalTrackPublication('foo', track, () => {});
        assert.equal(localTrackPublication.sid, 'foo');
      });
    });

    describe('#unpublish', () => {
      var localTrackPublication;
      var ret;
      var unpublish;

      before(() => {
        unpublish = sinon.spy();
        localTrackPublication = new LocalTrackPublication('foo', track, unpublish);
        ret = localTrackPublication.unpublish();
      });

      it('should call the unpublish callback (with the LocalTrackPublication) that is passed to the constructor', () => {
        sinon.assert.calledWith(unpublish, localTrackPublication);
      });

      it('should return the LocalTrackPublication', () => {
        assert.equal(ret, localTrackPublication);
      });
    });
  });
});
