'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');
const { inherits } = require('util');

const MediaTrack = require('../../../../../lib/media/track/mediatrack');
const MediaTrackTransceiver = require('../../../../../lib/media/track/transceiver');

const log = require('../../../../lib/fakelog');
const Document = require('../../../../lib/document');

describe('MediaTrack', () => {
  let _initialize;
  let track;

  before(() => {
    _initialize = MediaTrack.prototype._initialize;
    MediaTrack.prototype._initialize = sinon.spy();
    global.document = global.document || new Document();
  });

  after(() => {
    MediaTrack.prototype._initialize = _initialize;
    if (global.document instanceof Document) {
      delete global.document;
    }
  });

  describe('constructor', () => {
    before(() => {
      track = createMediaTrack('1', 'audio');
    });

    it('should call ._initialize', () => {
      assert.equal(track._initialize.callCount, 1);
    });
  });

  describe('_initialize', () => {
    let dummyElement;

    before(() => {
      track = createMediaTrack('1', 'audio');
      track._attach = sinon.spy();
      track._detachElement = sinon.spy();
      track._attachments.delete = sinon.spy();

      dummyElement = { oncanplay: 'bar' };
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

  describe('attach', () => {
    let element;
    let returnVal;

    context('when undefined is passed', () => {
      before(() => {
        track = createMediaTrack('1', 'audio');
        element = document.createElement('audio');

        track._createElement = sinon.spy(() => {
          return element;
        });
        track._selectElement = sinon.spy();
        track._attach = sinon.spy(() => {
          return element;
        });

        returnVal = track.attach();
      });

      it('should call _createElement', () => {
        assert.equal(track._createElement.callCount, 1);
      });

      it('should not call _selectElement', () => {
        assert.equal(track._selectElement.callCount, 0);
      });

      it('should call _attach with the created element', () => {
        assert(track._attach.calledWith(element));
      });

      it('should return the result of _attach', () => {
        assert(returnVal, element);
      });
    });

    context('when null is passed', () => {
      before(() => {
        track = createMediaTrack('1', 'audio');
        element = document.createElement('audio');

        track._createElement = sinon.spy(() => {
          return element;
        });
        track._selectElement = sinon.spy();
        track._attach = sinon.spy(() => {
          return element;
        });

        returnVal = track.attach(null);
      });

      it('should call _createElement', () => {
        assert.equal(track._createElement.callCount, 1);
      });

      it('should not call _selectElement', () => {
        assert.equal(track._selectElement.callCount, 0);
      });

      it('should call _attach with the created element', () => {
        assert(track._attach.calledWith(element));
      });

      it('should return the result of _attach', () => {
        assert(returnVal, element);
      });
    });

    context('when a string is passed', () => {
      before(() => {
        track = createMediaTrack('1', 'audio');
        element = document.createElement('audio');

        track._createElement = sinon.spy();
        track._selectElement = sinon.spy(() => {
          return element;
        });
        track._attach = sinon.spy(() => {
          return element;
        });

        returnVal = track.attach('.selector');
      });

      it('should not call _createElement', () => {
        assert.equal(track._createElement.callCount, 0);
      });

      it('should call _selectElement with the specified selector', () => {
        assert(track._selectElement.calledWith('.selector'));
        assert.equal(track._selectElement.callCount, 1);
      });

      it('should call _attach with the selected element', () => {
        assert(track._attach.calledWith(element));
      });

      it('should return the result of _attach', () => {
        assert(returnVal, element);
      });
    });

    context('when an element is passed', () => {
      before(() => {
        track = createMediaTrack('1', 'audio');
        element = document.createElement('audio');

        track._createElement = sinon.spy();
        track._selectElement = sinon.spy();
        track._attach = sinon.spy(() => {
          return element;
        });
        returnVal = track.attach(element);
      });

      it('should not call _createElement', () => {
        assert.equal(track._createElement.callCount, 0);
      });

      it('should not call _selectElement', () => {
        assert.equal(track._selectElement.callCount, 0);
      });

      it('should call _attach with the passed element', () => {
        assert(track._attach.calledWith(element));
      });

      it('should return the result of _attach', () => {
        assert(returnVal, element);
      });
    });
  });

  describe('_selectElement', () => {
    let element;
    before(() => {
      track = createMediaTrack('1', 'audio');

      element = document.createElement('audio');
      element.className = 'foo';
      document.body.appendChild(element);
    });

    after(() => {
      element.parentNode.removeChild(element);
    });

    context('when passed an invalid selector', () => {
      it('should throw an exception', () => {
        assert.throws(() => {
          track._selectElement('.nonexistant');
        });
      });
    });
  });

  describe('_createElement', () => {
    before(() => {
      track = createMediaTrack('1', 'video');
    });

    it('should return an element with the tagName of .kind', () => {
      assert.equal(track._createElement().tagName.toLowerCase(), 'video');
    });
  });

  describe('detach', () => {
    context('when el is undefined', () => {
      let attachedElements;

      before(() => {
        track = createMediaTrack('1', 'audio');
        attachedElements = [
          document.createElement('audio'),
          document.createElement('video')
        ];

        track._getAllAttachedElements = sinon.spy(() => {
          return attachedElements;
        });
        track._selectElement = sinon.spy();
        track._detachElements = sinon.spy(els => els);
        track.detach();
      });

      it('should call _getAllAttachedElements', () => {
        assert.equal(track._getAllAttachedElements.callCount, 1);
      });

      it('should not call _selectElement', () => {
        assert.equal(track._selectElement.callCount, 0);
      });

      it('should call _detach with the attached elements', () => {
        assert(track._detachElements.calledWith(attachedElements));
      });
    });

    context('when el is null', () => {
      let attachedElements;

      before(() => {
        track = createMediaTrack('1', 'audio');
        attachedElements = [
          document.createElement('audio'),
          document.createElement('video')
        ];

        track._getAllAttachedElements = sinon.spy(() => {
          return attachedElements;
        });
        track._selectElement = sinon.spy();
        track._detachElements = sinon.spy(els => els);
        track.detach(null);
      });

      it('should call _getAllAttachedElements', () => {
        assert.equal(track._getAllAttachedElements.callCount, 1);
      });

      it('should not call _selectElement', () => {
        assert.equal(track._selectElement.callCount, 0);
      });

      it('should call _detach with the attached elements', () => {
        assert(track._detachElements.calledWith(attachedElements));
      });
    });

    context('when el is a string', () => {
      let element;

      before(() => {
        track = createMediaTrack('1', 'audio');
        element = document.createElement('audio');

        track._getAllAttachedElements = sinon.spy();
        track._selectElement = sinon.spy(() => {
          return element;
        });
        track._detachElements = sinon.spy(els => els);
        track.detach('.foo');
      });

      it('should not call _getAllAttachedElements', () => {
        assert.equal(track._getAllAttachedElements.callCount, 0);
      });

      it('should call _selectElement', () => {
        assert.equal(track._selectElement.callCount, 1);
      });

      it('should call _detach with the attached element', () => {
        assert(track._detachElements.calledWith([element]));
      });
    });

    context('when el is an element', () => {
      let element;

      before(() => {
        track = createMediaTrack('1', 'audio');
        element = document.createElement('audio');

        track._getAllAttachedElements = sinon.spy();
        track._selectElement = sinon.spy();
        track._detachElements = sinon.spy(els => els);
        track.detach(element);
      });

      it('should not call _getAllAttachedElements', () => {
        assert.equal(track._getAllAttachedElements.callCount, 0);
      });

      it('should not call _selectElement', () => {
        assert.equal(track._selectElement.callCount, 0);
      });

      it('should call _detach with the specified element', () => {
        assert(track._detachElements.calledWith([element]));
      });
    });
  });

  describe('_updateElementsMediaStreamTrack', () => {
    it('should reattach each existing elements', () => {
      track = createMediaTrack('1', 'video');
      track._attach = sinon.spy();
      track._attachments.add('foo');
      track._attachments.add('bar');
      track._updateElementsMediaStreamTrack();

      sinon.assert.calledTwice(track._attach);
      assert.equal(track._attach.firstCall.args[0], 'foo');
      assert.equal(track._attach.secondCall.args[0], 'bar');
    });
  });

  describe('_getAllAttachedElements', () => {
    it('should return an array with all elements in ._attachments', () => {
      track = createMediaTrack('1', 'audio');
      track._attachments.add('foo');
      track._attachments.add('bar');

      assert.equal(track._getAllAttachedElements().toString(), ['foo', 'bar'].toString());
    });
  });

  describe('_detachElements', () => {
    it('should run _detachElement for each element passed', () => {
      track = createMediaTrack('1', 'audio');
      track._detachElement = sinon.spy();
      track._detachElements(['foo', 'bar']);
      assert.equal(track._detachElement.callCount, 2);
    });
  });

  describe('_detachElement', () => {
    let returnVal;
    let el1;
    let el2;

    before(() => {
      track = createMediaTrack('1', 'audio');
      el1 = document.createElement('audio');
      el1.srcObject = new MediaStream();
      el1.srcObject.addTrack(track.mediaStreamTrack);
      track._attachments.add(el1);

      returnVal = track._detachElement(el1);
    });

    context('when the element is attached', () => {
      it('should remove the MediaTrack\'s MediaStreamTrack from the element\'s .srcObject MediaStream', () => {
        assert.deepEqual(el1.srcObject.getTracks(), []);
      });

      it('should return the passed element', () => {
        assert.equal(returnVal, el1);
      });

      it('should remove the element from ._attachments', () => {
        assert(!track._attachments.has(el1));
      });
    });

    context('when the element is not attached', () => {
      before(() => {
        el2 = document.createElement('audio');
        returnVal = track._detachElement(el2);
      });

      it('should return the passed element', () => {
        assert.equal(returnVal, el2);
      });
    });
  });

  describe('_attach', () => {
    let el;
    let ret;
    let track;
    let mediaStream;
    let MediaStream;
    let processedTrack;

    beforeEach(() => {
      processedTrack = {
        getAudioTracks: sinon.stub(),
        getVideoTracks: sinon.stub(),
        kind: 'audio'
      };
      MediaStream = sinon.spy(function MediaStream() {
        // eslint-disable-next-line consistent-this
        mediaStream = this;
      });
      MediaStream.prototype.addTrack = sinon.spy();
      MediaStream.prototype.getAudioTracks = sinon.spy(() => [track.mediaStreamTrack]);
      MediaStream.prototype.removeTrack = sinon.spy();
      el = document.createElement('audio');
      track = createMediaTrack(1, 'audio', { MediaStream: MediaStream });
      track.processedTrack = null;
    });

    context('when the .srcObject of the HTMLMediaElement is not a MediaStream', () => {
      beforeEach(() => {
        MediaStream.prototype.getAudioTracks = sinon.spy(() => []);
        ret = track._attach(el);
      });

      it('should call the MediaStream constructor', () => {
        assert(MediaStream.calledOnce);
      });

      it('should not call .removeTrack() on the MediaStream', () => {
        assert(!MediaStream.prototype.removeTrack.calledOnce);
      });

      it('should call .addTrack() with the MediaTrack\'s MediaStreamTrack on the MediaStream', () => {
        assert(MediaStream.prototype.addTrack.calledWith(track.mediaStreamTrack));
      });

      context('when processedTrack is not null', () => {
        it('should call .addTrack() with the MediaTrack\'s processedTrack on the MediaStream', () => {
          track.processedTrack = processedTrack;
          track._attach(el);
          assert(MediaStream.prototype.addTrack.calledWith(processedTrack));
        });
      });

      it('should set the .srcObject of the HTMLMediaElement to the MediaStream', () => {
        assert.equal(el.srcObject, mediaStream);
      });

      it('should set the .autoplay of the HTMLMediaElement to true', () => {
        assert(el.autoplay);
      });

      it('should set the .playsInline of the HTMLMediaElement to true', () => {
        assert(el.playsInline);
      });

      it('should add the HTMLMediaElement to the ._attachments Set', () => {
        assert(track._attachments.has(el));
      });

      it('should return the HTMLMediaElement', () => {
        assert.equal(ret, el);
      });
    });

    context('when the .srcObject of the HTMLMediaElement is a MediaStream', () => {
      beforeEach(() => {
        el.srcObject = new MediaStream();
        ret = track._attach(el);
      });

      it('should not call the MediaStream constructor', () => {
        assert.equal(MediaStream.callCount, 1);
      });

      it('should call .getAudioTracks() on the MediaStream', () => {
        assert(MediaStream.prototype.getAudioTracks.calledOnce);
      });

      it('should call .removeTrack() with the current audio MediaStreamTrack on the MediaStream', () => {
        assert(MediaStream.prototype.removeTrack.calledWith(track.mediaStreamTrack));
      });

      it('should call .addTrack() with the MediaTrack\'s MediaStreamTrack on the MediaStream', () => {
        assert(MediaStream.prototype.addTrack.calledWith(track.mediaStreamTrack));
      });

      context('when processedTrack is not null', () => {
        it('should call .addTrack() with the MediaTrack\'s processedTrack on the MediaStream', () => {
          track.processedTrack = processedTrack;
          track._attach(el);
          assert(MediaStream.prototype.addTrack.calledWith(processedTrack));
        });
      });

      it('should set the .srcObject of the HTMLMediaElement to the MediaStream', () => {
        assert.equal(el.srcObject, mediaStream);
      });

      it('should set the .autoplay of the HTMLMediaElement to true', () => {
        assert(el.autoplay);
      });

      it('should set the .playsInline of the HTMLMediaElement to true', () => {
        assert(el.playsInline);
      });

      it('should add the HTMLMediaElement to the ._attachments Set', () => {
        assert(track._attachments.has(el));
      });

      it('should return the HTMLMediaElement', () => {
        assert.equal(ret, el);
      });
    });
  });
});

function createMediaTrack(id, kind, options) {
  const mediaStreamTrack = new MediaStreamTrack(id, kind);
  const mediaTrackTransceiver = new MediaTrackTransceiver(id, mediaStreamTrack);
  return new MediaTrack(mediaTrackTransceiver, Object.assign({ log: log }, options));
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
