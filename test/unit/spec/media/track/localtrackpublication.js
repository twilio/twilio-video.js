'use strict';

var assert = require('assert');
var LocalAudioTrackPublication = require('../../../../../lib/media/track/localaudiotrackpublication');
var LocalVideoTrackPublication = require('../../../../../lib/media/track/localvideotrackpublication');
var sinon = require('sinon');

[
  ['LocalAudioTrackPublication', LocalAudioTrackPublication],
  ['LocalVideoTrackPublication', LocalVideoTrackPublication]
].forEach(pair => {
  var description = pair[0];
  var LocalTrackPublication = pair[1];
  var kind = {
    LocalAudioTrackPublication: 'audio',
    LocalVideoTrackPublication: 'video'
  };

  describe(description, function() {
    describe('constructor', () => {
      context('when called without the "options" argument', () => {
        [
          [
            'when called without the "new" keyword',
            () => LocalTrackPublication('foo', 'bar', () => {})
          ],
          [
            'when called with the "new" keyword',
            () => new LocalTrackPublication('bar', 'baz', () => {})
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

      it('should populate the .id property', () => {
        var localTrackPublication = new LocalTrackPublication('foo', 'bar', () => {});
        assert.equal(localTrackPublication.id, 'bar');
      });

      it('should populate the .kind property', () => {
        var localTrackPublication = new LocalTrackPublication('foo', 'bar', () => {});
        assert.equal(localTrackPublication.kind, kind[description]);
      });

      it('should populate the .sid property', () => {
        var localTrackPublication = new LocalTrackPublication('foo', 'bar', () => {});
        assert.equal(localTrackPublication.sid, 'foo');
      });
    });

    describe('#unpublish', () => {
      var localTrackPublication;
      var ret;
      var unpublish;

      before(() => {
        unpublish = sinon.spy();
        localTrackPublication = new LocalTrackPublication('foo', 'bar', unpublish);
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
