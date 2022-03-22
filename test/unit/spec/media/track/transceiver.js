'use strict';

const assert = require('assert');
const MediaTrackTransceiver = require('../../../../../lib/media/track/transceiver');

describe('MediaTrackTransceiver', () => {
  describe('constructor', () => {
    const id = 'foo';
    const mid = 'zoo';
    const mediaStreamTrack = { id: 'bar', kind: 'baz', readyState: 'zee' };
    let transceiver;

    before(() => {
      transceiver = new MediaTrackTransceiver(id, mid, mediaStreamTrack);
    });

    it('should set the .id property', () => {
      assert.equal(transceiver.id, id);
    });

    it('should set the .kind property to the MediaStreamTrack\'s .kind', () => {
      assert.equal(transceiver.kind, mediaStreamTrack.kind);
    });

    it('should set the .mid property', () => {
      assert.equal(transceiver.mid, mid);
    });

    it('should set the .readyState property to the MediaStreamTrack\'s .readyState', () => {
      assert.equal(transceiver.readyState, mediaStreamTrack.readyState);
    });

    it('should set the .track property', () => {
      assert.equal(transceiver.track, mediaStreamTrack);
    });

    context('when the MediaStreamTrack\'s .readyState changes', () => {
      const newReadyState = 'ended';

      before(() => {
        mediaStreamTrack.readyState = newReadyState;
      });

      it('should update the MediaTrackTransceiver\'s .readyState', () => {
        assert.equal(transceiver.readyState, newReadyState);
      });
    });
  });
});
