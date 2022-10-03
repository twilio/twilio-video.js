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

    before(() => {
      track = createAudioTrack('1', 'audio');
      track._attach = sinon.spy();
      track._detachElement = sinon.spy();
      track._attachments.delete = sinon.spy();

      dummyElement = { oncanplay: 'bar', remove: sinon.spy(), srcObject: 'something' };
      track._createElement = sinon.spy(() => {
        return dummyElement;
      });

      _initialize.call(track);
    });

    it('should call ._createElement', () => {
      assert.equal(track._createElement.callCount, 1);
    });

    it('should call ._attach with the created element', () => {
      assert(track._attach.calledWith(dummyElement));
    });

    it('should call .delete with the created element on the ._attachments Set', () => {
      assert(track._attachments.delete.calledWith(dummyElement));
    });

    it('should set el.oncanplay to a function', () => {
      assert.equal(typeof dummyElement.oncanplay, 'function');
    });

    it('should set el.muted to true', () => {
      assert.equal(dummyElement.muted, true);
    });

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
    });
  });

});

function createAudioTrack(id, kind, options) {
  const mediaStreamTrack = new MediaStreamTrack(id, kind);
  const mediaTrackTransceiver = new MediaTrackTransceiver(id, mediaStreamTrack);
  const mediaTrack = new AudioTrack(mediaTrackTransceiver, Object.assign({ log: log }, options));
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
