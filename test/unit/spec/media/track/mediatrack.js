'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');
const { inherits } = require('util');

const MediaTrack = require('../../../../../lib/media/track/mediatrack');

const log = require('../../../../lib/fakelog');

describe('MediaTrack', function() {
  let _initialize;
  let track;

  before(function() {
    _initialize = MediaTrack.prototype._initialize;
    MediaTrack.prototype._initialize = sinon.spy();
  });

  after(function() {
    MediaTrack.prototype._initialize = _initialize;
  });

  describe('constructor', function() {
    before(function() {
      track = createMediaTrack('1', 'audio');
    });

    it('should call ._initialize', function() {
      assert.equal(track._initialize.callCount, 1);
    });
  });

  describe('_initialize', function() {
    let dummyElement;

    before(function() {
      track = createMediaTrack('1', 'audio');
      track._attach = sinon.spy();
      track._detachElement = sinon.spy();
      track._attachments.delete = sinon.spy();

      dummyElement = { oncanplay: 'bar' };
      track._createElement = sinon.spy(function() {
        return dummyElement;
      });

      _initialize.call(track);
    });

    it('should call ._createElement', function() {
      assert.equal(track._createElement.callCount, 1);
    });

    it('should call ._attach with the created element', function() {
      assert(track._attach.calledWith(dummyElement));
    });

    it ('should call .delete with the created element on the ._attachments Set', () => {
      assert(track._attachments.delete.calledWith(dummyElement));
    });

    it('should set el.oncanplay to a function', function() {
      assert.equal(typeof dummyElement.oncanplay, 'function');
    });

    it('should set el.muted to true', function() {
      assert.equal(dummyElement.muted, true);
    });

    context('when the dummy element emits oncanplay event', function() {
      it('should emit MediaTrack#started, passing the instance of MediaTrack', function(done) {
        _initialize.call(track);
        track.on('started', function(_track) {
          done(track !== _track && new Error('Did not return the instance of MediaTrack'));
        });

        dummyElement.oncanplay();
      });

      it('should call ._detachElement with the passed element', function() {
        assert(track._detachElement.calledWith(dummyElement));
      });

      it('should set .isStarted to true', function() {
        assert(track.isStarted);
      });

      it('should set the element\'s oncanplay to null', function() {
        assert.equal(dummyElement.oncanplay, null);
      });
    });
  });

  describe('attach', function() {
    let element;
    let returnVal;

    context('when undefined is passed', function() {
      before(function() {
        track = createMediaTrack('1', 'audio');
        element = document.createElement('audio');

        track._createElement = sinon.spy(function() {
          return element;
        });
        track._selectElement = sinon.spy();
        track._attach = sinon.spy(function() {
          return element;
        });

        returnVal = track.attach();
      });

      it('should call _createElement', function() {
        assert.equal(track._createElement.callCount, 1);
      });

      it('should not call _selectElement', function() {
        assert.equal(track._selectElement.callCount, 0);
      });

      it('should call _attach with the created element', function() {
        assert(track._attach.calledWith(element));
      });

      it('should return the result of _attach', function() {
        assert(returnVal, element);
      });
    });

    context('when null is passed', function() {
      before(function() {
        track = createMediaTrack('1', 'audio');
        element = document.createElement('audio');

        track._createElement = sinon.spy(function() {
          return element;
        });
        track._selectElement = sinon.spy();
        track._attach = sinon.spy(function() {
          return element;
        });

        returnVal = track.attach(null);
      });

      it('should call _createElement', function() {
        assert.equal(track._createElement.callCount, 1);
      });

      it('should not call _selectElement', function() {
        assert.equal(track._selectElement.callCount, 0);
      });

      it('should call _attach with the created element', function() {
        assert(track._attach.calledWith(element));
      });

      it('should return the result of _attach', function() {
        assert(returnVal, element);
      });
    });

    context('when a string is passed', function() {
      before(function() {
        track = createMediaTrack('1', 'audio');
        element = document.createElement('audio');

        track._createElement = sinon.spy();
        track._selectElement = sinon.spy(function() {
          return element;
        });
        track._attach = sinon.spy(function() {
          return element;
        });

        returnVal = track.attach('.selector');
      });

      it('should not call _createElement', function() {
        assert.equal(track._createElement.callCount, 0);
      });

      it('should call _selectElement with the specified selector', function() {
        assert(track._selectElement.calledWith('.selector'));
        assert.equal(track._selectElement.callCount, 1);
      });

      it('should call _attach with the selected element', function() {
        assert(track._attach.calledWith(element));
      });

      it('should return the result of _attach', function() {
        assert(returnVal, element);
      });
    });

    context('when an element is passed', function() {
      before(function() {
        track = createMediaTrack('1', 'audio');
        element = document.createElement('audio');

        track._createElement = sinon.spy();
        track._selectElement = sinon.spy();
        track._attach = sinon.spy(function() {
          return element;
        });
        returnVal = track.attach(element);
      });

      it('should not call _createElement', function() {
        assert.equal(track._createElement.callCount, 0);
      });

      it('should not call _selectElement', function() {
        assert.equal(track._selectElement.callCount, 0);
      });

      it('should call _attach with the passed element', function() {
        assert(track._attach.calledWith(element));
      });

      it('should return the result of _attach', function() {
        assert(returnVal, element);
      });
    });
  });

  describe('_selectElement', function() {
    let element;
    before(function() {
      track = createMediaTrack('1', 'audio');

      element = document.createElement('audio');
      element.className = 'foo';
      document.body.appendChild(element);
    });

    after(function() {
      element.parentNode.removeChild(element);
    });

    context('when passed an invalid selector', function() {
      it('should throw an exception', function() {
        assert.throws(function() {
          track._selectElement('.nonexistant');
        });
      });
    });

    context('when passed a valid selector', function() {
      it('should return the matched element', function() {
        assert.equal(track._selectElement('.foo'), element);
      });
    });
  });

  describe('_createElement', function() {
    before(function() {
      track = createMediaTrack('1', 'video');
    });

    it('should return an element with the tagName of .kind', function() {
      assert.equal(track._createElement().tagName.toLowerCase(), 'video');
    });
  });

  describe('detach', function() {
    context('when el is undefined', function() {
      let attachedElements;

      before(function() {
        track = createMediaTrack('1', 'audio');
        attachedElements = [
          document.createElement('audio'),
          document.createElement('video')
        ];

        track._getAllAttachedElements = sinon.spy(function() {
          return attachedElements;
        });
        track._selectElement = sinon.spy();
        track._detachElements = sinon.spy(function(els) { return els; });
        track.detach();
      });

      it('should call _getAllAttachedElements', function() {
        assert.equal(track._getAllAttachedElements.callCount, 1);
      });

      it('should not call _selectElement', function() {
        assert.equal(track._selectElement.callCount, 0);
      });

      it('should call _detach with the attached elements', function() {
        assert(track._detachElements.calledWith(attachedElements));
      });
    });

    context('when el is null', function() {
      let attachedElements;

      before(function() {
        track = createMediaTrack('1', 'audio');
        attachedElements = [
          document.createElement('audio'),
          document.createElement('video')
        ];

        track._getAllAttachedElements = sinon.spy(function() {
          return attachedElements;
        });
        track._selectElement = sinon.spy();
        track._detachElements = sinon.spy(function(els) { return els; });
        track.detach(null);
      });

      it('should call _getAllAttachedElements', function() {
        assert.equal(track._getAllAttachedElements.callCount, 1);
      });

      it('should not call _selectElement', function() {
        assert.equal(track._selectElement.callCount, 0);
      });

      it('should call _detach with the attached elements', function() {
        assert(track._detachElements.calledWith(attachedElements));
      });
    });

    context('when el is a string', function() {
      let element;

      before(function() {
        track = createMediaTrack('1', 'audio');
        element = document.createElement('audio');

        track._getAllAttachedElements = sinon.spy();
        track._selectElement = sinon.spy(function() {
          return element;
        });
        track._detachElements = sinon.spy(function(els) { return els; });
        track.detach('.foo');
      });

      it('should not call _getAllAttachedElements', function() {
        assert.equal(track._getAllAttachedElements.callCount, 0);
      });

      it('should call _selectElement', function() {
        assert.equal(track._selectElement.callCount, 1);
      });

      it('should call _detach with the attached element', function() {
        assert(track._detachElements.calledWith([element]));
      });
    });

    context('when el is an element', function() {
      let element;

      before(function() {
        track = createMediaTrack('1', 'audio');
        element = document.createElement('audio');

        track._getAllAttachedElements = sinon.spy();
        track._selectElement = sinon.spy();
        track._detachElements = sinon.spy(function(els) { return els; });
        track.detach(element);
      });

      it('should not call _getAllAttachedElements', function() {
        assert.equal(track._getAllAttachedElements.callCount, 0);
      });

      it('should not call _selectElement', function() {
        assert.equal(track._selectElement.callCount, 0);
      });

      it('should call _detach with the specified element', function() {
        assert(track._detachElements.calledWith([element]));
      });
    });
  });

  describe('_getAllAttachedElements', function() {
    it('should return an array with all elements in ._attachments', function() {
      track = createMediaTrack('1', 'audio');
      track._attachments.add('foo');
      track._attachments.add('bar');

      assert.equal(track._getAllAttachedElements().toString(), ['foo', 'bar'].toString());
    });
  });

  describe('_detachElements', function() {
    it('should run _detachElement for each element passed', function() {
      track = createMediaTrack('1', 'audio');
      track._detachElement = sinon.spy();
      track._detachElements(['foo', 'bar']);
      assert.equal(track._detachElement.callCount, 2);
    });
  });

  describe('_detachElement', function() {
    let returnVal;
    let el1;
    let el2;

    before(function() {
      track = createMediaTrack('1', 'audio');
      el1 = document.createElement('audio');
      el1.srcObject = new MediaStream();
      el1.srcObject.addTrack(track.mediaStreamTrack);
      track._attachments.add(el1);

      returnVal = track._detachElement(el1);
    });

    context('when the element is attached', function() {
      it('should remove the MediaTrack\'s MediaStreamTrack from the element\'s .srcObject MediaStream', function() {
        assert.deepEqual(el1.srcObject.getTracks(), []);
      });

      it('should return the passed element', function() {
        assert.equal(returnVal, el1);
      });

      it('should remove the element from ._attachments', function() {
        assert(!track._attachments.has(el1));
      });
    });

    context('when the element is not attached', function() {
      before(function() {
        el2 = document.createElement('audio');
        returnVal = track._detachElement(el2);
      });

      it('should return the passed element', function() {
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

    beforeEach(() => {
      MediaStream = sinon.spy(function () { mediaStream = this; });
      MediaStream.prototype.addTrack = sinon.spy();
      MediaStream.prototype.getAudioTracks = sinon.spy(() => [track.mediaStreamTrack]);
      MediaStream.prototype.removeTrack = sinon.spy();
      el = document.createElement('audio');
      track = createMediaTrack(1, 'audio', {MediaStream: MediaStream});
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
  return new MediaTrack(mediaStreamTrack, Object.assign({ log: log }, options));
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
