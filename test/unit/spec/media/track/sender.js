'use strict';

const assert = require('assert');
const MediaTrackSender = require('../../../../../lib/media/track/sender');

describe('MediaTrackSender', () => {
  const mediaStreamTrack = { id: 'bar', kind: 'baz', readyState: 'zee' };
  let sender;

  describe('constructor', () => {
    [true, false].forEach(shouldUseNewKwd => {
      context(`when called with${shouldUseNewKwd ? '' : 'out'} the "new" keyword`, () => {
        before(() => {
          // eslint-disable-next-line new-cap
          sender = shouldUseNewKwd ? new MediaTrackSender(mediaStreamTrack) : MediaTrackSender(mediaStreamTrack);
        });

        it('should return a MediaTrackSender', () => {
          assert(sender instanceof MediaTrackSender);
        });

        ['id', 'kind', 'readyState'].forEach(prop => {
          it(`should set the .${prop} to the MediaStreamTrack's .${prop}`, () => {
            assert.equal(sender[prop], mediaStreamTrack[prop]);
          });
        });

        it('should set the .track property', () => {
          assert.equal(sender.track, mediaStreamTrack);
        });

        context('when the MediaStreamTrack\'s .readyState changes', () => {
          const newReadyState = 'ended';

          before(() => {
            mediaStreamTrack.readyState = newReadyState;
          });

          it('should update the MediaTrackTransceiver\'s .readyState', () => {
            assert.equal(sender.readyState, newReadyState);
          });
        });
      });
    });
  });

  ['addSender', 'removeSender'].forEach(method => {
    describe(`#${method}`, () => {
      before(() => {
        sender = new MediaTrackSender(mediaStreamTrack);
      });

      describe('called with an RTCRtpSender that has', () => {
        [
          ['never been added', () => {}],
          ['been added', (trackSender, sender) => {
            trackSender.addSender(sender);
          }],
          ['been removed', (trackSender, sender) => {
            trackSender.addSender(sender);
            trackSender.removeSender(sender);
          }]
        ].forEach(([scenario, setup]) => {
          context(scenario, () => {
            const rtpSender = { track: 'foo' };
            let ret;

            before(() => {
              setup(sender, rtpSender);
              ret = sender[method](rtpSender);
            });

            it('should return the MediaTrackSender', () => {
              assert.equal(ret, sender);
            });
          });
        });
      });
    });
  });
});
