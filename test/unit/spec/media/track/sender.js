/* eslint no-use-before-define:0 */
'use strict';

const assert = require('assert');
const MediaTrackSender = require('../../../../../lib/media/track/sender');
const Document = require('../../../../lib/document');
const sinon = require('sinon');
const { combinationContext, waitForEvent } = require('../../../../lib/util');
const { FakeMediaStreamTrack } = require('../../../../lib/fakemediastream');

describe('MediaTrackSender', () => {
  before(() => {
    global.document = global.document || new Document();
  });

  after(() => {
    if (global.document instanceof Document) {
      delete global.document;
    }
  });

  const mediaStreamTrack = new FakeMediaStreamTrack('audio');
  const mstClone = mediaStreamTrack.clone;

  mediaStreamTrack.clone = () => {
    clonedMediaStreamTrack = mstClone.call(mediaStreamTrack);
    return clonedMediaStreamTrack;
  };

  let clonedMediaStreamTrack;
  let sender;

  describe('constructor', () => {
    before(() => {
      sender = new MediaTrackSender(mediaStreamTrack);
    });

    it('should return a MediaTrackSender', () => {
      assert(sender instanceof MediaTrackSender);
    });

    ['id', 'kind', 'muted', 'readyState'].forEach(prop => {
      it(`should set the .${prop} to the MediaStreamTrack's .${prop}`, () => {
        assert.equal(sender[prop], mediaStreamTrack[prop]);
      });
    });

    it('should set the .track property', () => {
      assert.equal(sender.track, mediaStreamTrack);
    });

    context('when the MediaStreamTrack\'s .muted changes', () => {
      before(() => {
        mediaStreamTrack.setMuted(false);
      });

      it('should update the MediaTrackTransceiver\'s .muted', () => {
        assert.equal(sender.muted, false);
      });
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

    context('when the MediaStreamTrack emits "mute" and "unmute" events', () => {
      let eventsPromise;

      before(() => {
        eventsPromise = Promise.all(['muted', 'unmuted'].map(event => waitForEvent(sender, event).then(() => event)));
        mediaStreamTrack.setMuted(true);
        mediaStreamTrack.setMuted(false);
      });

      it('should emit "muted" and "unmuted" events respectively', async () => {
        const events = await eventsPromise;
        assert.deepStrictEqual(events, ['muted', 'unmuted']);
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

      const result = await trackSender.setPublisherHint(encodings);
      assert.strictEqual(result, 'OK');
    });
  });

  describe('setMediaStreamTrack', () => {
    combinationContext([
      [
        [true, false],
        x => `when the current MediaStreamTrack's .muted is ${x}`
      ],
      [
        [true, false],
        x => `when the new MediaStreamTrack's .muted is ${x}`
      ],
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
    ], ([currentMuted, newMuted, replaceTrackSuccess, publisherHintCallbackSet, publisherHintSuccess]) => {

      let events;
      let msTrackReplaced;
      let rtpSender;
      let publisherHitCallBack;
      let result;
      let errorResult;
      let trackSender;

      beforeEach(async () => {
        const msTrackOrig = new FakeMediaStreamTrack('audio');
        msTrackOrig.setMuted(currentMuted);

        trackSender = new MediaTrackSender(msTrackOrig);
        msTrackReplaced = new FakeMediaStreamTrack('audio');
        msTrackReplaced.setMuted(newMuted);

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

        events = [];
        ['muted', 'unmuted'].forEach(event => trackSender.once(event, () => events.push(event)));

        try {
          result = await trackSender.setMediaStreamTrack(msTrackReplaced);
        } catch (error) {
          errorResult = error;
        }
      });

      it('calls RTCRtpSender.replaceTrack', () => {
        sinon.assert.calledWith(rtpSender.replaceTrack, msTrackReplaced);
      });

      if (currentMuted === newMuted) {
        it('should neither emit "muted" nor "unmuted" events', () => {
          assert.deepStrictEqual(events, []);
        });
      } else {
        const expectedEvent = newMuted ? 'muted' : 'unmuted';
        it(`should emit "${expectedEvent}"`, () => {
          assert.deepStrictEqual(events, [expectedEvent]);
        });
      }

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
        assert.strictEqual(trackSender.track.id, msTrackReplaced.id);
      });
    });
  });
});
