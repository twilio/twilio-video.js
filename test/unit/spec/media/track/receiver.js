'use strict';

const assert = require('assert');
const MediaTrackReceiver = require('../../../../../lib/media/track/receiver');

describe('MediaTrackReceiver', () => {
  describe('constructor', () => {
    const id = 'foo';
    const mediaStreamTrack = { id: 'bar', kind: 'baz', readyState: 'zee' };
    let receiver;

    [true, false].forEach(shouldUseNewKwd => {
      context(`when called with${shouldUseNewKwd ? '' : 'out'} the "new" keyword`, () => {
        before(() => {
          // eslint-disable-next-line new-cap
          receiver = shouldUseNewKwd ? new MediaTrackReceiver(id, mediaStreamTrack) : MediaTrackReceiver(id, mediaStreamTrack);
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
  });
});
