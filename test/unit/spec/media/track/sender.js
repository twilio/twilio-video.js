/* eslint no-use-before-define:0 */
'use strict';

const assert = require('assert');
const MediaTrackSender = require('../../../../../lib/media/track/sender');
const Document = require('../../../../lib/document');

describe('MediaTrackSender', () => {
  before(() => {
    global.document = global.document || new Document();
  });

  after(() => {
    if (global.document instanceof Document) {
      delete global.document;
    }
  });

  const mediaStreamTrack = {
    id: 'bar',
    kind: 'baz',
    readyState: 'zee',
    clone() {
      return clonedMediaStreamTrack;
    }
  };

  const clonedMediaStreamTrack = Object.assign({}, mediaStreamTrack, {
    id: 'cloned'
  });

  let sender;

  describe('constructor', () => {
    before(() => {
      sender = new MediaTrackSender(mediaStreamTrack);
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

  describe('isPublishing', () => {
    it('should return true if there are clones', () => {
      sender = new MediaTrackSender(mediaStreamTrack);
      sender.clone();
      assert(sender.isPublishing);
    });

    it('should return false if there are no clones', () => {
      sender = new MediaTrackSender(mediaStreamTrack);
      assert(!sender.isPublishing);
    });
  });

  describe('clone', () => {
    it('returns a new MediaTrackSender containing a clone of the underlying MediaStreamTrack', () => {
      sender = new MediaTrackSender(mediaStreamTrack);
      const clonedSender = sender.clone();
      assert.notEqual(clonedSender, sender);
      assert.notEqual(clonedSender.track, sender.track);
      assert.equal(clonedSender.track, clonedMediaStreamTrack);
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
