'use strict';

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var Track = require('../../../../lib/media/track');
var sinon = require('sinon');

describe('Track', function() {
  var _initialize;
  var mediaStream;
  var track;

  before(function() {
    _initialize = Track.prototype._initialize;
    Track.prototype._initialize = sinon.spy();
  });

  afterEach(function() {
    Track.prototype._initialize = sinon.spy();
  });

  describe('constructor', function() {
    before(function() {
      mediaStream = new MediaStream();
      track = createTrack(mediaStream, '1', 'audio');
    });

    it('should call ._initialize', function() {
      assert.equal(track._initialize.callCount, 1);
    });
  });

  describe('_initialize', function() {
    var dummyElement;

    before(function() {
      mediaStream = new MediaStream();
      track = createTrack(mediaStream, '1', 'audio');
      track._attach = sinon.spy();
      track._detachElement = sinon.spy();

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

    it('should set el.oncanplay to a function', function() {
      assert.equal(typeof dummyElement.oncanplay, 'function');
    });

    it('should set mediaStreamTrack.onended to a function', function() {
      assert.equal(typeof track.mediaStreamTrack.onended, 'function');
    });

    it('should set el.muted to true', function() {
      assert.equal(dummyElement.muted, true);
    });

    context('when the underlying MediaStreamTrack emits ended event', function() {
      it('should emit Track#ended event', function(done) {
        _initialize.call(track);
        track.on('ended', function() { done(); });
        track.mediaStreamTrack.onended();
      });

      it('should call ._detachElement with the dummy element', function() {
        assert(track._detachElement.calledWith(dummyElement));
      });

      it('should set the element\'s oncanplay callback to null', function() {
        assert.equal(dummyElement.oncanplay, null);
      });
    });

    context('when the dummy element emits oncanplay event', function() {
      it('should emit Track#started, passing the instance of Track', function(done) {
        _initialize.call(track);
        track.on('started', function(_track) {
          done(track !== _track && new Error('Did not return the instance of Track'));
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
    var element;
    var returnVal;

    context('when undefined is passed', function() {
      before(function() {
        mediaStream = new MediaStream();
        track = createTrack(mediaStream, '1', 'audio');
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
        mediaStream = new MediaStream();
        track = createTrack(mediaStream, '1', 'audio');
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
        mediaStream = new MediaStream();
        track = createTrack(mediaStream, '1', 'audio');
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
        mediaStream = new MediaStream();
        track = createTrack(mediaStream, '1', 'audio');
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

  describe('_enable', function() {
    before(function() {
      mediaStream = new MediaStream();
      track = createTrack(mediaStream, '1', 'audio');
      track._isEnabled = false;
    });

    context('when called with true once', function() {
      before(function() {
        track.emit = sinon.spy();
        track._enable(true);
      });

      it('should set .isEnabled to true', function() {
        assert.equal(track.isEnabled, true);
      });

      it('should emit Track#enabled', function() {
        assert(track.emit.calledWith('enabled', track));
      });
    });

    context('when called with true again', function() {
      before(function() {
        track.emit = sinon.spy();
        track._enable(true);
      });

      it('should keep .isEnabled at true', function() {
        assert.equal(track.isEnabled, true);
      });

      it('should not emit', function() {
        assert.equal(track.emit.callCount, 0);
      });
    });

    context('when called with false once', function() {
      before(function() {
        track.emit = sinon.spy();
        track._enable(false);
      });

      it('should set .isEnabled to false', function() {
        assert.equal(track.isEnabled, false);
      });

      it('should emit Track#disabled', function() {
        assert(track.emit.calledWith('disabled', track));
      });
    });

    context('when called with false again', function() {
      before(function() {
        track.emit = sinon.spy();
        track._enable(false);
      });

      it('should keep .isEnabled at false', function() {
        assert.equal(track.isEnabled, false);
      });

      it('should not emit', function() {
        assert.equal(track.emit.callCount, 0);
      });
    });

    context('when called with null once', function() {
      before(function() {
        track.emit = sinon.spy();
        track._enable(null);
      });

      it('should set .isEnabled to true', function() {
        assert.equal(track.isEnabled, true);
      });

      it('should emit Track#disabled', function() {
        assert(track.emit.calledWith('enabled', track));
      });
    });

    context('when called with null again', function() {
      before(function() {
        track.emit = sinon.spy();
        track._enable(null);
      });

      it('should keep .isEnabled at true', function() {
        assert.equal(track.isEnabled, true);
      });

      it('should not emit', function() {
        assert.equal(track.emit.callCount, 0);
      });
    });
  });

  describe('_selectElement', function() {
    var element;
    before(function() {
      mediaStream = new MediaStream();
      track = createTrack(mediaStream, '1', 'audio');

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
      mediaStream = new MediaStream();
      track = createTrack(mediaStream, '1', 'video');
    });

    it('should return an element with the tagName of .kind', function() {
      assert.equal(track._createElement()._localName, 'video');
    });
  });

  describe('detach', function() {
    context('when el is undefined', function() {
      var attachedElements;

      before(function() {
        mediaStream = new MediaStream();
        track = createTrack(mediaStream, '1', 'audio');
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
      var attachedElements;

      before(function() {
        mediaStream = new MediaStream();
        track = createTrack(mediaStream, '1', 'audio');
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
      var element;

      before(function() {
        mediaStream = new MediaStream();
        track = createTrack(mediaStream, '1', 'audio');
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
      var element;

      before(function() {
        mediaStream = new MediaStream();
        track = createTrack(mediaStream, '1', 'audio');
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
    it('should return an array with all elements in .attachments', function() {
      mediaStream = new MediaStream();
      track = createTrack(mediaStream, '1', 'audio');
      track.attachments.add('foo');
      track.attachments.add('bar');

      assert.equal(track._getAllAttachedElements().toString(), ['foo', 'bar'].toString());
    });
  });

  describe('_detachElements', function() {
    it('should run _detachElement for each element passed', function() {
      mediaStream = new MediaStream();
      track = createTrack(mediaStream, '1', 'audio');
      track._detachElement = sinon.spy();
      track._detachElements(['foo', 'bar']);
      assert.equal(track._detachElement.callCount, 2);
    });
  });

  describe('_detachElement', function() {
    var returnVal;
    var el1, el2;

    before(function() {
      mediaStream = new MediaStream();
      track = createTrack(mediaStream, '1', 'audio');
      el1 = document.createElement('audio');
      el1.removeAttribute = sinon.spy();
      track.attachments.add(el1);

      returnVal = track._detachElement(el1);
    });

    context('when the element is attached', function() {
      it('should call el.removeAttribute with src', function() {
        assert(el1.removeAttribute.calledWith('src'));
      });

      it('should return the passed element', function() {
        assert.equal(returnVal, el1);
      });

      it('should remove the element from .attachments', function() {
        assert(!track.attachments.has(el1));
      });
    });

    context('when the element is not attached', function() {
      before(function() {
        el2 = document.createElement('audio');
        el2.removeAttribute = sinon.spy();
        returnVal = track._detachElement(el2);
      });

      it('should not call el.removeAttribute', function() {
        assert.equal(el2.removeAttribute.callCount, 0);
      });

      it('should return the passed element', function() {
        assert.equal(returnVal, el2);
      });
    });
  });

  describe('_attach', function() {
    var el;
    var oldNavigator;
    var oldWindow;

    before(function() {
      oldWindow = global.window;
      oldNavigator = global.navigator;

      global.window = undefined;
      global.navigator = undefined;
    });

    after(function() {
      global.window = oldWindow;
      global.navigator = oldNavigator;
    });

    context('when window does not exist', function() {
      before(function() {
        global.window = undefined;
        global.navigator = { };

        mediaStream = new MediaStream();
        track = createTrack(mediaStream, '1', 'audio');
        el = document.createElement('audio');
      });

      it('should throw an exception', function() {
        assert.throws(function() { track._attach(el); });
      });

      it('should not add the element to .attachments', function() {
        assert(!track.attachments.has(el));
      });
    });

    context('when navigator does not exist', function() {
      before(function() {
        global.window = { };
        global.navigator = undefined;

        mediaStream = new MediaStream();
        track = createTrack(mediaStream, '1', 'audio');
        el = document.createElement('audio');
      });

      it('should throw an exception', function() {
        assert.throws(function() { track._attach(el); });
      });

      it('should not add the element to .attachments', function() {
        assert(!track.attachments.has(el));
      });
    });

    context('when navigator.webkitGetUserMedia is a function', function() {
      before(function() {
        global.window = { URL: { createObjectURL: sinon.spy(function() {
          return 'foobar';
        }) } };
        global.navigator = {
          webkitGetUserMedia: function() { }
        };

        mediaStream = new MediaStream();
        track = createTrack(mediaStream, '1', 'audio');
        el = document.createElement('audio');

        track._attach(el);
      });

      it('should add the element to .attachments', function() {
        assert(track.attachments.has(el));
      });

      it('should call window.URL.createObjectURL with the mediaStream', function() {
        assert(global.window.URL.createObjectURL.calledWith(track.mediaStream));
      });

      it('should set el.src to createObjectURL\'s returned value', function() {
        assert.equal(el.src, 'foobar');
      });
    });

    context('when navigator.mozGetUserMedia is a function', function() {
      before(function() {
        global.window = { URL: { createObjectURL: sinon.spy(function() {
          return 'foobar';
        }) } };
        global.navigator = {
          mozGetUserMedia: function() { }
        };

        mediaStream = new MediaStream();
        track = createTrack(mediaStream, '1', 'audio');
        el = document.createElement('audio');

        track._attach(el);
      });

      it('should add the element to .attachments', function() {
        assert(track.attachments.has(el));
      });

      it('should not call window.URL.createObjectURL', function() {
        assert.equal(global.window.URL.createObjectURL.callCount, 0);
      });

      it('should set el.mozSrcObject to the mediaStream', function() {
        assert.equal(el.mozSrcObject, track.mediaStream);
      });
    });

    context('when neither navigator functions exists', function() {
      before(function() {
        global.window = { URL: { createObjectURL: sinon.spy(function() {
          return 'foobar';
        }) } };
        global.navigator = { };

        mediaStream = new MediaStream();
        track = createTrack(mediaStream, '1', 'audio');
        el = document.createElement('audio');

        track._attach(el);
      });

      it('should add the element to .attachments', function() {
        assert(track.attachments.has(el));
      });

      it('should not call window.URL.createObjectURL', function() {
        assert.equal(global.window.URL.createObjectURL.callCount, 0);
      });

      it('should not set el.mozSrcObject to the mediaStream', function() {
        assert.equal(el.mozSrcObject, undefined);
      });
    });

    context('when the element is already attached', function() {
      var returnVal;

      before(function() {
        mediaStream = new MediaStream();
        track = createTrack(mediaStream, '1', 'audio');
        el = document.createElement('audio');
        track.attachments.add(el);

        returnVal = track._attach(el);
      });

      it('should return the element', function() {
        assert.equal(returnVal, el);
      });
    });
  });
});

function createTrack(mediaStream, id, kind) {
  var mediaStreamTrack = new MediaStreamTrack(id, kind);
  mediaStream._tracks[kind].set(id, mediaStreamTrack);
  return new Track(mediaStream, mediaStreamTrack);
}

function MediaStream() {
  var tracks = {
    audio: new Map(),
    video: new Map()
  };

  Object.defineProperties(this, {
    _tracks: { get: function() { return tracks; } },
    getAudioTracks: {
      value: function() { return tracks.audio; }
    },
    getVideoTracks: {
      value: function() { return tracks.video; }
    },
    getTracks: {
      value: function() { return tracks.video.concat(tracks.audio); }
    },
  });
};

function MediaStreamTrack(id, kind) {
  var track = new EventEmitter();

  Object.defineProperties(track, {
    id: { value: id },
    kind: { value: kind }
  });

  return track;
}

