const assert = require('assert');
const sinon = require('sinon');
const { FakeMediaStreamTrack } = require('../../../lib/fakemediastream');
const LocalTrackPublicationSignaling = require('../../../../lib/signaling/localtrackpublication');
const MediaTrackSender = require('../../../../lib/media/track/sender');
const DataTrackSender = require('../../../../lib/data/sender');

describe('LocalTrackPublicationSignaling', () => {
  describe('constructor', () => {
    [true, false].forEach(enabledState => {
      it(`should maintain track enabled state (${enabledState}) during publication`, () => {
        const mediaStreamTrack = new FakeMediaStreamTrack('audio');
        mediaStreamTrack.enabled = enabledState;

        const trackSender = new MediaTrackSender(mediaStreamTrack);
        assert.strictEqual(trackSender.track.enabled, enabledState);

        const publication = new LocalTrackPublicationSignaling(trackSender, 'track1', 'standard');

        assert.strictEqual(publication.trackTransceiver.track.enabled, enabledState);
        assert.strictEqual(publication.isEnabled, enabledState);
      });
    });

    it('should always set isEnabled to true when publishing DataTrackSender', () => {
      const dataTrackSender = new DataTrackSender();
      const publication = new LocalTrackPublicationSignaling(dataTrackSender, 'data1', 'standard');

      assert.strictEqual(publication.isEnabled, true);
    });

    // NOTE(lrivas): Test case for Safari 18 MediaStreamTrack clone()
    // Bug report: https://bugs.webkit.org/show_bug.cgi?id=281758
    describe('when Safari 18 MediaStreamTrack clone() does not preserve enabled state', () => {
      let originalClone;
      let mediaStreamTrack;

      beforeEach(() => {
        originalClone = FakeMediaStreamTrack.prototype.clone;
        mediaStreamTrack = new FakeMediaStreamTrack('audio');
        mediaStreamTrack.enabled = false;

        // Mock Safari's clone() behavior where it doesn't preserve enabled state
        sinon.stub(FakeMediaStreamTrack.prototype, 'clone').callsFake(function() {
          const clonedTrack = originalClone.call(FakeMediaStreamTrack.prototype);
          clonedTrack.enabled = true;
          return clonedTrack;
        });
      });

      afterEach(() => {
        FakeMediaStreamTrack.prototype.clone.restore();
      });

      it('should preserve disabled state despite Safari clone() bug', () => {
        const trackSender = new MediaTrackSender(mediaStreamTrack);
        const publication = new LocalTrackPublicationSignaling(trackSender, 'track1', 'standard');

        assert.strictEqual(trackSender.track.enabled, false, 'Track sender should remain disabled');
        assert.strictEqual(publication.trackTransceiver.track.enabled, false, 'Publication track should remain disabled');
        assert.strictEqual(publication.isEnabled, false, 'Publication should remain disabled');
      });
    });
  });
});
