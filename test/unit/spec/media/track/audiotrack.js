'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');
const { inherits } = require('util');

const AudioTrack = require('../../../../../lib/media/track/audiotrack');
const MediaTrackTransceiver = require('../../../../../lib/media/track/transceiver');

const log = require('../../../../lib/fakelog');
const Document = require('../../../../lib/document');

describe('AudioTrack', () => {
  let _initialize;
  let track;

  before(() => {
    _initialize = AudioTrack.prototype._initialize;
    AudioTrack.prototype._initialize = sinon.spy();
    global.document = global.document || new Document();
  });

  after(() => {
    AudioTrack.prototype._initialize = _initialize;
    if (global.document instanceof Document) {
      delete global.document;
    }
  });

  describe('_initialize', () => {
    let dummyElement;

    [null, '1'].forEach(id => {
      context(`when called with ${id ? 'non-' : ''}null .mediaTrackTransceiver`, () => {
        before(() => {
          track = createAudioTrack(id, 'foo', 'audio');
          track._attach = sinon.spy();
          track._detachElement = sinon.spy();
          track._attachments.delete = sinon.spy();

          dummyElement = { oncanplay: 'bar', remove: sinon.spy(), srcObject: 'something' };
          track._createElement = sinon.spy(() => {
            return dummyElement;
          });

          _initialize.call(track);
        });

        it(`should ${id ? '' : 'not '}call ._createElement`, () => {
          assert.equal(track._createElement.callCount, id ? 1 : 0);
        });

        it(`should ${id ? '' : 'not '}call ._attach with the created element`, () => {
          assert.equal(track._attach.calledWith(dummyElement), !!id);
        });

        it('should not add dummyElement to _attachments', () => {
          assert(!track._attachments.has(dummyElement));
        });

        it(`should ${id ? '' : 'not '}set el.oncanplay to a function`, () => {
          assert.equal(typeof dummyElement.oncanplay, id ? 'function' : 'string');
        });

        it(`should ${id ? '' : 'not '}set el.muted to true`, () => {
          assert.equal(dummyElement.muted, id ? true : undefined);
        });

        if (id) {
          context('when the dummy element emits oncanplay event', () => {
            it('should emit MediaTrack#started, passing the instance of MediaTrack', async () => {
              _initialize.call(track);

              const trackPromise = new Promise(resolve => track.on('started', resolve));

              dummyElement.oncanplay();

              const _track = await trackPromise;
              assert.equal(track, _track);
            });

            it('should set .isStarted to true', () => {
              assert(track.isStarted);
            });

            it('should set the element\'s oncanplay to null', () => {
              assert.equal(dummyElement.oncanplay, null);
            });

            it('should set the element\'s srcObject to null', () => {
              assert.equal(dummyElement.srcObject, null);
            });
          });
        }
      });
    });
  });
});

function createAudioTrack(id, mid, options) {
  const mediaStreamTrack = new MediaStreamTrack(id, 'audio');
  const mediaTrackTransceiver = id ? new MediaTrackTransceiver(id, mid, mediaStreamTrack) : null;
  const mediaTrack = new AudioTrack(mediaTrackTransceiver, Object.assign({ log: log, name: 'bar' }, options));
  mediaTrack.tranceiver = mediaTrackTransceiver;
  return mediaTrack;
}

function MediaStreamTrack(id, kind) {
  EventEmitter.call(this);

  Object.defineProperties(this, {
    id: { value: id },
    kind: { value: kind }
  });
}

inherits(MediaStreamTrack, EventEmitter);

MediaStreamTrack.prototype.addEventListener = MediaStreamTrack.prototype.addListener;

MediaStreamTrack.prototype.removeEventListener = MediaStreamTrack.prototype.removeListener;
