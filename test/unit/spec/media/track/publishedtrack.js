'use strict';

var assert = require('assert');
var PublishedAudioTrack = require('../../../../../lib/media/track/publishedaudiotrack');
var PublishedVideoTrack = require('../../../../../lib/media/track/publishedvideotrack');
var sinon = require('sinon');

[
  ['PublishedAudioTrack', PublishedAudioTrack],
  ['PublishedVideoTrack', PublishedVideoTrack]
].forEach(pair => {
  var description = pair[0];
  var PublishedTrack = pair[1];
  var kind = {
    PublishedAudioTrack: 'audio',
    PublishedVideoTrack: 'video'
  };

  describe(description, function() {
    describe('constructor', () => {
      context('when called without the "options" argument', () => {
        [
          [
            'when called without the "new" keyword',
            () => PublishedTrack('foo', 'bar')
          ],
          [
            'when called with the "new" keyword',
            () => new PublishedTrack('bar', 'baz')
          ]
        ].forEach(([ scenario, createPublishedTrack ]) => {
          context(scenario, () => {
            it('should not throw', () => {
              assert.doesNotThrow(createPublishedTrack);
            });

            it(`should return an instance of ${description}`, () => {
              assert(createPublishedTrack() instanceof PublishedTrack);
            });
          });
        });
      });

      it('should populate the .id property', () => {
        var publishedTrack = new PublishedTrack('foo', 'bar');
        assert.equal(publishedTrack.id, 'bar');
      });

      it('should populate the .kind property', () => {
        var publishedTrack = new PublishedTrack('foo', 'bar');
        assert.equal(publishedTrack.kind, kind[description]);
      });

      it('should populate the .sid property', () => {
        var publishedTrack = new PublishedTrack('foo', 'bar');
        assert.equal(publishedTrack.sid, 'foo');
      });
    });

    describe('#unpublish', () => {});
  });
});
