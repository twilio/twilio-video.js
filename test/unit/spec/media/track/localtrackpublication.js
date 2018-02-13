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
  });
});
