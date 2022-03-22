'use strict';

const assert = require('assert');
const MediaTrackReceiver = require('../../../../../lib/media/track/receiver');

describe('MediaTrackReceiver', () => {
  describe('constructor', () => {
    const id = 'foo';
    const mid = 'zoo';
    const mediaStreamTrack = { id: 'bar', kind: 'baz', readyState: 'zee' };
    let receiver;

    before(() => {
      receiver = new MediaTrackReceiver(id, mid, mediaStreamTrack);
    });

    it('should return a MediaTrackReceiver', () => {
      assert(receiver instanceof MediaTrackReceiver);
    });

    it('should set the .id property', () => {
      assert.equal(receiver.id, id);
    });

    it('should set the .kind property to the MediaStreamTrack\'s .kind', () => {
      assert.equal(receiver.kind, mediaStreamTrack.kind);
    });

    it('should set the .mid property', () => {
      assert.equal(receiver.mid, mid);
    });

    it('should set the .readyState property to the MediaStreamTrack\'s .readyState', () => {
      assert.equal(receiver.readyState, mediaStreamTrack.readyState);
    });

    it('should set the .track property', () => {
      assert.equal(receiver.track, mediaStreamTrack);
    });

    context('when the MediaStreamTrack\'s .readyState changes', () => {
      const newReadyState = 'ended';

      before(() => {
        mediaStreamTrack.readyState = newReadyState;
      });

      it('should update the MediaTrackTransceiver\'s .readyState', () => {
        assert.equal(receiver.readyState, newReadyState);
      });
    });
  });
});
