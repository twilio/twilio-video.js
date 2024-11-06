const assert = require('assert');
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
  });
});
