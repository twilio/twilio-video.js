/* eslint no-use-before-define:0 */
'use strict';

const assert = require('assert');
const MediaTrackSender = require('../../../../../lib/media/track/sender');
const Document = require('../../../../lib/document');
const sinon = require('sinon');
const { combinationContext } = require('../../../../lib/util');

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

    it('should set .mid to null', () => {
      assert.equal(sender.mid, null);
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

  describe('setPublisherHint', () => {
    it('resolves to "COULD_NOT_APPLY_HINT" when publisher hint callback is not set', async () => {
      const trackSender = new MediaTrackSender(mediaStreamTrack);
      const rtpSender = { track: 'foo' };
      trackSender.addSender(rtpSender);
      // eslint-disable-next-line camelcase
      const result = await trackSender.setPublisherHint({ enabled: false, layer_index: 0 });
      assert.strictEqual(result, 'COULD_NOT_APPLY_HINT');
    });

    it('forwards to callback if set', async () => {
      const trackSender = new MediaTrackSender(mediaStreamTrack);
      const rtpSender1 = { track: 'foo' };
      const rtpSender2 = { track: 'bar' };
      // eslint-disable-next-line camelcase
      const encodings = [{ enabled: false, layer_index: 0 }];
      const publisherHintCallback = payload => {
        assert.deepStrictEqual(encodings, payload);
        return Promise.resolve('OK');
      };
      trackSender.addSender(rtpSender2);
      trackSender.addSender(rtpSender1, publisherHintCallback);

      // eslint-disable-next-line camelcase
      const result = await trackSender.setPublisherHint(encodings);
      assert.strictEqual(result, 'OK');
    });
  });

  describe('setMediaStreamTrack', () => {
    combinationContext([
      [
        [true, false],
        x => `when replaceTrack ${x ? 'resolves' : 'rejects'}`
      ],
      [
        [true, false],
        x => `when publisher hint callback is ${x ? '' : 'not '} set`
      ],
      [
        [true, false],
        x => `when publisherHitCallBack ${x ? 'resolves' : 'rejects'}`
      ],
    ], ([replaceTrackSuccess, publisherHintCallbackSet, publisherHintSuccess]) => {

      let msTrackReplaced;
      let rtpSender;
      let publisherHitCallBack;
      let result;
      let errorResult;
      let trackSender;
      beforeEach(async () => {
        const msTrackOrig = makeMediaStreamTrack({ id: 'original' });
        trackSender = new MediaTrackSender(msTrackOrig);
        msTrackReplaced = makeMediaStreamTrack({ id: 'replaced' });
        rtpSender = {
          track: 'foo',
          replaceTrack: sinon.spy(() => replaceTrackSuccess ? Promise.resolve('yay') : Promise.reject('boo'))
        };

        publisherHitCallBack = sinon.spy(() => publisherHintSuccess ? Promise.resolve('yes') : Promise.reject('no'));
        if (publisherHintCallbackSet) {
          trackSender.addSender(rtpSender, publisherHitCallBack);
        } else {
          trackSender.addSender(rtpSender);
        }

        try {
          result = await trackSender.setMediaStreamTrack(msTrackReplaced);
        } catch (error) {
          errorResult = error;
        }
      });

      it('calls RTCRtpSender.replaceTrack', () => {
        sinon.assert.calledWith(rtpSender.replaceTrack, msTrackReplaced);
      });

      if (replaceTrackSuccess) {
        it('resolves', () => {
          assert(result);
          assert(!errorResult);
        });
      } else {
        it('rejects', () => {
          assert(!result);
          assert(errorResult);
        });
      }

      if (publisherHintCallbackSet && replaceTrackSuccess) {
        it('sets default publisher hint', () => {
          sinon.assert.calledWith(publisherHitCallBack, null);
        });
      } else {
        it('does not set default publisher hint', () => {
          sinon.assert.notCalled(publisherHitCallBack);
        });
      }

      it('always replaces the track', () => {
        assert.strictEqual(trackSender.track.id, 'replaced');
      });
    });
  });
});

function makeMediaStreamTrack({ id = 'foo', kind = 'baz', readyState = 'zee' }) {
  return {
    id, kind, readyState,
    clone: () => {
      return { id: 'cloned_' + id, kind, readyState };
    }
  };
}
