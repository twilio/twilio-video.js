'use strict';

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var Media = require('../../../../lib/media/index');
var sinon = require('sinon');

describe('Media', function() {
  this.timeout(10);

  var media;
  describe('_addRemoteStream', function() {
    var mediaStream;
    var returnVal;

    before(function() {
      media = createMedia();

      mediaStream = {
        getAudioTracks: function() { return [{ }, { }, { }]; },
        getVideoTracks: function() { return [{ }, { }]; }
      };

      media._addTrack = sinon.spy();

      returnVal = media._addRemoteStream(mediaStream);
    });

    it('should call _addTrack for each track of the remote MediaStreams', function() {
      assert.equal(media._addTrack.callCount, 5);
    });

    it('should return the Media instance', function() {
      assert.equal(returnVal, media);
    });
  });

  describe('_addTrack', function() {
    var audioTrackMock;
    var videoTrackMock;
    var returnVal1;
    var returnVal2;

    before(function() {
      media = createMedia();

      audioTrackMock = new MediaStreamTrack('foo', 'audio');
      videoTrackMock = new MediaStreamTrack('bar', 'video');

      media._reemitTrackEvent = sinon.spy();
      media._removeTrack = sinon.spy();
    });

    it('should emit Media#trackAdded event', function(done) {
      media.once('trackAdded', function() { done(); });
      media._addTrack(videoTrackMock);
      returnVal1 = media._addTrack(audioTrackMock);
      returnVal2 = media._addTrack(videoTrackMock);
    });

    it('should add the audioTrack to media.audioTracks Set exactly once', function() {
      assert.equal(media.audioTracks.size, 1);
    });

    it('should call _reemitTrackEvent for every event we want reemited', function() {
      assert.equal(media._reemitTrackEvent.callCount, 10);
      assert(media._reemitTrackEvent.calledWith, 'disabled');
      assert(media._reemitTrackEvent.calledWith, 'enabled');
      assert(media._reemitTrackEvent.calledWith, 'started');
      assert(media._reemitTrackEvent.calledWith, 'ended');
      assert(media._reemitTrackEvent.calledWith, 'dimensionsChanged');
    });

    it('should add the videoTrack to media.videoTracks Set exactly once', function() {
      assert.equal(media.videoTracks.size, 1);
    });

    it('should add the tracks to .tracks Map', function() {
      assert.equal(media.tracks.get(audioTrackMock.id), audioTrackMock);
      assert.equal(media.tracks.get(videoTrackMock.id), videoTrackMock);
    });

    it('should add the Tracks\' MediaStreams to .mediaStreams Set', function() {
      assert(media.mediaStreams.has(audioTrackMock.mediaStream));
      assert(media.mediaStreams.has(videoTrackMock.mediaStream));
    });

    it('should return the Media instance', function() {
      assert.equal(returnVal1, media);
      assert.equal(returnVal2, media);
    });

    // JSDK-549
    it('should not call _removeTrack when the Track emits Track#ended', function() {
      audioTrackMock.emit('ended');
      assert.equal(media._removeTrack.callCount, 0);
    });
  });
  
  describe('_reemitTrackEvent', function() {
    var audioTrack;
    var videoTrack;

    before(function() {
      media = createMedia();
    });

    beforeEach(function() {
      audioTrack = new MediaStreamTrack('foo', 'audio');
      videoTrack = new MediaStreamTrack('bar', 'video');
    });

    context('when the track is not in the Media\'s tracks', function() {
      it('should call removeListener on the track', function() {
        audioTrack.removeListener = sinon.spy();
        media._reemitTrackEvent(audioTrack, 'foo', 'bar');
        audioTrack.emit('foo');
        assert.equal(audioTrack.removeListener.callCount, 1);
      });
    });

    context('when the track is in the Media\'s tracks', function() {
      it('should emit the specified event when the specified audio track emits the specified track event', function(done) {
        media._addTrack(audioTrack);
        media._reemitTrackEvent(audioTrack, 'foo', 'bar');

        media.once('bar', function() { done(); });
        audioTrack.emit('foo');
      });

      it('should emit the specified event when the specified video track emits the specified track event', function(done) {
        media._addTrack(videoTrack);
        media._reemitTrackEvent(videoTrack, 'baz', 'qux');

        media.once('qux', function() { done(); });
        videoTrack.emit('baz');
      });
    });
  });

  describe('_refreshTracks', function() {
    var mediaStream;

    before(function() {
      media = createMedia();

      var audioTracks = [
        new MediaStreamTrack('1', 'audio'),
        new MediaStreamTrack('2', 'audio')
      ];

      var videoTracks = [
        new MediaStreamTrack('3', 'video')
      ];

      mediaStream = {
        getAudioTracks: function() {
          return audioTracks;
        },
        getVideoTracks: function() {
          return videoTracks;
        },
        getTracks: function() {
          return videoTracks.concat(audioTracks);
        }
      };

      media._addRemoteStream(mediaStream);

      media._removeTrack = sinon.spy();
      media._addRemoteStream = sinon.spy();

      media.tracks.delete('1');
      media.tracks.delete('2');
      media.tracks.set('4', new MediaStreamTrack('4', 'video'));
      media.tracks.set('5', new MediaStreamTrack('5', 'audio'));
      media.tracks.set('6', new MediaStreamTrack('6', 'audio'));

      media._refreshTracks();
    });

    it('should call ._removeTrack for every Track whose MediaStream is not in .mediaStreams', function() {
      assert.equal(media._removeTrack.callCount, 3);
    });

    it('should call ._addRemoteStream for every MediaStream in .mediaStreams', function() {
      assert.equal(media._addRemoteStream.callCount, 1);
    });
  });

  describe('_createTrackElement', function() {
    var returnVal;
    var track;

    before(function() {
      media = createMedia();

      track = new MediaStreamTrack('aud', 'audio');
      track.attach = sinon.spy(function() { return 'foo'; });

      returnVal = media._createTrackElement(track);
    });

    it('should call track.attach', function() {
      assert.equal(track.attach.callCount, 1);
    });

    it('should return the value of track.attach', function() {
      assert.equal(returnVal, 'foo');
    });
  });

  describe('_attachTrack', function() {
    var attachments;
    var el;
    var track;
    var trackEl;

    before(function() {
      media = createMedia();

      track = new MediaStreamTrack('aud', 'audio');
      el = document.createElement('div');
      attachments = new Map();

      media._detachTrack = sinon.spy();
      media._createTrackElement = sinon.spy(function() {
        trackEl = document.createElement('p');
        return trackEl;
      });

      media._attachTrack(el, attachments, track);
    });

    it('should call ._createTrackElement', function() {
      assert.equal(media._createTrackElement.callCount, 1);
    });

    it('should append the generated track element to the passed parent element', function() {
      assert.equal(trackEl.parentNode, el);
    });

    it('should add the track element to the passed attachments Map', function() {
      assert.equal(attachments.get(track), trackEl);
    });

    it('should call ._detachTrack when track emits Track#ended', function() {
      assert.equal(media._detachTrack.callCount, 0);
      track.emit('ended');
      assert.equal(media._detachTrack.callCount, 1);
    });
  });

  describe('_detachTrack', function() {
    var attachments;
    var el;
    var returnVal;
    var track;
    var trackEl;

    before(function() {
      media = createMedia();
      attachments = new Map();

      el = document.createElement('div');
      el.removeChild = sinon.spy();

      track = new MediaStreamTrack('aud', 'audio');
      track.detach = sinon.spy();

      trackEl = document.createElement('div');
      el.appendChild(trackEl);
    });

    context('when the track is not attached to the DOM', function() {
      it('should not call track.detach', function() {
        media._detachTrack(attachments, track);
        assert.equal(track.detach.callCount, 0);
      });
    });

    context('when the track is attached to the DOM', function() {
      it('should call track.detach', function() {
        attachments.set(track, trackEl);
        media._detachTrack(attachments, track);
        assert(track.detach.calledWith(trackEl));
      });

      it('should call parentNode.removeChild if the track element has a parentNode', function() {
        assert(el.removeChild.calledWith(trackEl));
      });

      it('should remove the track from the attachments Map', function() {
        assert.equal(attachments.size, 0);
      });
    });
  });

  describe('_removeTrack', function() {
    var audioTracks;
    var mediaStream;
    var videoTracks;

    before(function() {
      media = createMedia();
      media.emit = sinon.spy();

      audioTracks = [ new MediaStreamTrack('1', 'audio') ];
      videoTracks = [ new MediaStreamTrack('2', 'video') ];

      mediaStream = {
        getAudioTracks: function() { return audioTracks; },
        getVideoTracks: function() { return videoTracks; },
        getTracks: function() { return videoTracks.concat(audioTracks); }
      };

      media._updateMediaStreams = sinon.spy();
    });

    context('when the track is not in .tracks', function() {
      it('should not emit Media#trackRemoved', function() {
        media._removeTrack(audioTracks[0]);
        assert.equal(media.emit.callCount, 0);
      });

      it('should not call ._updateMediaStreams', function() {
        assert.equal(media._updateMediaStreams.callCount, 0);
      });
    });

    context('when the track is in .tracks', function() {
      before(function() {
        media._addRemoteStream(mediaStream);
      });

      it('should remove AudioTrack from .audioTracks', function() {
        assert(media.tracks.has(audioTracks[0].id));
        assert(media.audioTracks.has(audioTracks[0].id));

        media._removeTrack(audioTracks[0]);
        assert(!media.audioTracks.has(audioTracks[0].id));
      });

      it('should call ._updateMediaStreams', function() {
        assert.equal(media._updateMediaStreams.callCount, 1);
      });

      it('should remove VideoTrack from .videoTracks', function() {
        assert(media.tracks.has(videoTracks[0].id));
        assert(media.videoTracks.has(videoTracks[0].id));

        media._removeTrack(videoTracks[0]);
        assert(!media.videoTracks.has(videoTracks[0].id));
      });

      it('should remove each Track from .tracks', function() {
        assert(!media.tracks.has(videoTracks[0].id));
        assert(!media.tracks.has(audioTracks[0].id));
      });

      it('should emit Media#trackRemoved', function() {
        assert(media.emit.calledWith('trackRemoved'));
      });
    });
  });

  describe('_updateMediaStreams', function() {
    var audioTracks, videoTracks;
    var mediaStream;
    var newMediaStream;
    var newVideoTracks;

    before(function() {
      media = createMedia();

      mediaStream = function() { };
      Object.defineProperties(mediaStream, {
        getAudioTracks: {
          value: function() { return audioTracks; }
        },
        getVideoTracks: {
          value: function() { return videoTracks; }
        },
        getTracks: {
          value: function() { return videoTracks.concat(audioTracks); }
        }
      });

      audioTracks = [ new MediaStreamTrack('1', 'audio') ];
      videoTracks = [ new MediaStreamTrack('2', 'video') ];

      media._addRemoteStream(mediaStream);
    });

    context('when a track with an existing MediaStream is added', function() {
      it('should not affect .mediaStreams', function() {
        var newAudioTrack = new MediaStreamTrack('3', 'audio');
        audioTracks.push(newAudioTrack);
        media.tracks.set('3', new TrackFactory(mediaStream, newAudioTrack));
        media._updateMediaStreams();

        assert.equal(media.mediaStreams.size, 1);
        assert(media.mediaStreams.has(mediaStream));
      });
    });

    context('when tracks with new MediaStreams have been added', function() {
      before(function() {
        newMediaStream = function() { };
        newVideoTracks = [new MediaStreamTrack('4', 'video')];

        Object.defineProperties(newMediaStream, {
          getAudioTracks: {
            value: function() { return []; }
          },
          getVideoTracks: {
            value: function() { return newVideoTracks; }
          },
          getTracks: {
            value: function() { return newVideoTracks; }
          }
        });
      });

      it('should add the new MediaStream to .mediaStreams', function() {
        media.tracks.set('4', new TrackFactory(newMediaStream, newVideoTracks[0]));
        media._updateMediaStreams();

        assert.equal(media.mediaStreams.size, 2);
        assert(media.mediaStreams.has(mediaStream));
        assert(media.mediaStreams.has(newMediaStream));
      });
    });

    context('when a track who shares a MediaStream is removed', function() {
      it('should not affect .mediaStreams', function() {
        media.tracks.delete('1');
        media._updateMediaStreams();

        assert.equal(media.mediaStreams.size, 2);
        assert(media.mediaStreams.has(mediaStream));
        assert(media.mediaStreams.has(newMediaStream));
      });
    });

    context('when a track with a unique MediaStream is removed', function() {
      it('should remove the MediaStream from .mediaStreams', function() {
        media.tracks.delete('4');
        media._updateMediaStreams();

        assert.equal(media.mediaStreams.size, 1);
        assert(media.mediaStreams.has(mediaStream));
        assert(!media.mediaStreams.has(newMediaStream));
      });
    });
  });

  describe('attach', function() {
    var container;
    var returnVal;

    context('when undefined is passed', function() {
      before(function() {
        media = createMedia();
        container = document.createElement('div');

        media._createContainer = sinon.spy(function() {
          return container;
        });
        media._selectContainer = sinon.spy();
        media._attach = sinon.spy(function() {
          return container;
        });
        returnVal = media.attach();
      });

      it('should call _createContainer', function() {
        assert.equal(media._createContainer.callCount, 1);
      });

      it('should not call _selectContainer', function() {
        assert.equal(media._selectContainer.callCount, 0);
      });

      it('should call _attach with the created container', function() {
        assert(media._attach.calledWith(container));
      });

      it('should return the result of _attach', function() {
        assert(returnVal, container);
      });
    });

    context('when null is passed', function() {
      before(function() {
        media = createMedia();
        container = document.createElement('div');

        media._createContainer = sinon.spy(function() {
          return container;
        });
        media._selectContainer = sinon.spy();
        media._attach = sinon.spy(function() {
          return container;
        });

        returnVal = media.attach(null);
      });

      it('should call _createContainer', function() {
        assert.equal(media._createContainer.callCount, 1);
      });

      it('should not call _selectContainer', function() {
        assert.equal(media._selectContainer.callCount, 0);
      });

      it('should call _attach with the created container', function() {
        assert(media._attach.calledWith(container));
      });

      it('should return the result of _attach', function() {
        assert(returnVal, container);
      });
    });

    context('when a string is passed', function() {
      before(function() {
        media = createMedia();
        container = document.createElement('div');

        media._createContainer = sinon.spy();
        media._selectContainer = sinon.spy(function() {
          return container;
        });
        media._attach = sinon.spy(function() {
          return container;
        });

        returnVal = media.attach('.selector');
      });

      it('should not call _createContainer', function() {
        assert.equal(media._createContainer.callCount, 0);
      });

      it('should call _selectContainer', function() {
        assert.equal(media._selectContainer.callCount, 1);
      });

      it('should call _attach with the selected container', function() {
        assert(media._attach.calledWith(container));
      });

      it('should return the result of _attach', function() {
        assert(returnVal, container);
      });
    });

    context('when an element is passed', function() {
      before(function() {
        media = createMedia();
        container = document.createElement('div');

        media._createContainer = sinon.spy();
        media._selectContainer = sinon.spy();
        media._attach = sinon.spy(function() {
          return container;
        });
        returnVal = media.attach(container);
      });

      it('should not call _createContainer', function() {
        assert.equal(media._createContainer.callCount, 0);
      });

      it('should not call _selectContainer', function() {
        assert.equal(media._selectContainer.callCount, 0);
      });

      it('should call _attach with the passed container', function() {
        assert(media._attach.calledWith(container));
      });

      it('should return the result of _attach', function() {
        assert(returnVal, container);
      });
    });
  });

  describe('_createContainer', function() {
    before(function() {
      media = createMedia();
    });

    it('should return a div element', function() {
      assert.equal(media._createContainer()._localName, 'div');
    });
  });

  describe('_selectContainer', function() {
    var container;
    before(function() {
      media = createMedia();

      container = document.createElement('div');
      container.className = 'foo';
      document.body.appendChild(container);
    });

    context('when passed an invalid selector', function() {
      it('should throw an exception', function() {
        assert.throws(function() {
          media._selectContainer('.nonexistant');
        });
      });
    });

    context('when passed a valid selector', function() {
      it('should return the matched element', function() {
        assert.equal(media._selectContainer('.foo'), container);
      });
    });
  });

  describe('_attach', function() {
    var audioTrack;
    var container;
    var mediaStream;
    var returnVal;

    before(function() {
      media = createMedia();
      audioTrack = new MediaStreamTrack('aud', 'audio');

      var audioTracks = [
        new MediaStreamTrack('1', 'audio'),
        new MediaStreamTrack('2', 'audio')
      ];

      var videoTracks = [
        new MediaStreamTrack('3', 'video')
      ];

      mediaStream = {
        getAudioTracks: function() {
          return audioTracks;
        },
        getVideoTracks: function() {
          return videoTracks;
        },
        getTracks: function() {
          return videoTracks.concat(audioTracks);
        }
      };

      media._addRemoteStream(mediaStream);

      media._attachTrack = sinon.spy();
      media._detachTrack = sinon.spy();
      media.removeListener = sinon.spy();

      container = document.createElement('div');
      returnVal = media._attach(container);
    });

    context('when the Media object does not contain the element', function() {
      it('should call _attachTrack for each track on the Media object', function() {
        assert.equal(media._attachTrack.callCount, 3);
      });

      it('should add the attachments to .attachments using the element as the key', function() {
        assert(media.attachments.has(container));
      });

      it('should return the passed container', function() {
        assert.equal(returnVal, container);
      });

      context('when the element is still attached', function() {
        it('should call _attachTrack with the specified track on Media#trackAdded', function() {
          media.emit('trackAdded', audioTrack);
          assert.equal(media._attachTrack.callCount, 4);
        });

        it('should call _detachTrack with the specified track on Media#trackRemoved', function() {
          media.emit('trackRemoved', audioTrack);
          assert.equal(media._detachTrack.callCount, 1);
        });
      });

      context('when the element is detached', function() {
        before(function() {
          media.attachments.delete(container);
        });

        it('should remove the trackAdded listener on Media#trackAdded', function() {
          media.emit('trackAdded', audioTrack);
          assert.equal(media.removeListener.callCount, 1);
        });

        it('should removed the trackRemoved listener on Media#trackRemoved', function() {
          media.emit('trackRemoved', audioTrack);
          assert.equal(media.removeListener.callCount, 2);
        });
      });
    });

    context('when .attachments already contains the element', function() {
      before(function() {
        container = document.createElement('div');
        media._attach(container);

        media._attachTrack = sinon.spy();
      });

      it('should return the attached element', function() {
        assert.equal(media._attach(container), container);
      });

      it('should not call attachTrack', function() {
        assert.equal(media._attachTrack.callCount, 0);
      });
    });
  });

  describe('detach', function() {
    context('when el is undefined', function() {
      var attachedContainers;

      before(function() {
        media = createMedia();
        attachedContainers = [
          document.createElement('div'),
          document.createElement('div')
        ];

        media._getAllAttachedContainers = sinon.spy(function() {
          return attachedContainers;
        });
        media._selectContainer = sinon.spy();
        media._detachContainers = sinon.spy(function(els) { return els; });
        media.detach();
      });

      it('should call _getAllAttachedContainers', function() {
        assert.equal(media._getAllAttachedContainers.callCount, 1);
      });

      it('should not call _selectContainer', function() {
        assert.equal(media._selectContainer.callCount, 0);
      });

      it('should call _detach with the attached containers', function() {
        assert(media._detachContainers.calledWith(attachedContainers));
      });
    });

    context('when el is null', function() {
      var attachedContainers;

      before(function() {
        media = createMedia();
        attachedContainers = [
          document.createElement('div'),
          document.createElement('div')
        ];

        media._getAllAttachedContainers = sinon.spy(function() {
          return attachedContainers;
        });
        media._selectContainer = sinon.spy();
        media._detachContainers = sinon.spy(function(els) { return els; });
        media.detach(null);
      });

      it('should call _getAllAttachedContainers', function() {
        assert.equal(media._getAllAttachedContainers.callCount, 1);
      });

      it('should not call _selectContainer', function() {
        assert.equal(media._selectContainer.callCount, 0);
      });

      it('should call _detach with the attached containers', function() {
        assert(media._detachContainers.calledWith(attachedContainers));
      });
    });

    context('when el is a string', function() {
      var container;

      before(function() {
        media = createMedia();
        container = document.createElement('div');

        media._getAllAttachedContainers = sinon.spy();
        media._selectContainer = sinon.spy(function() {
          return container;
        });
        media._detachContainers = sinon.spy(function(els) { return els; });
        media.detach('.foo');
      });

      it('should not call _getAllAttachedContainers', function() {
        assert.equal(media._getAllAttachedContainers.callCount, 0);
      });

      it('should call _selectContainer', function() {
        assert.equal(media._selectContainer.callCount, 1);
      });

      it('should call _detach with the attached container', function() {
        assert(media._detachContainers.calledWith([container]));
      });
    });

    context('when el is an element', function() {
      var container;

      before(function() {
        media = createMedia();
        container = document.createElement('div');

        media._getAllAttachedContainers = sinon.spy();
        media._selectContainer = sinon.spy();
        media._detachContainers = sinon.spy(function(els) { return els; });
        media.detach(container);
      });

      it('should not call _getAllAttachedContainers', function() {
        assert.equal(media._getAllAttachedContainers.callCount, 0);
      });

      it('should not call _selectContainer', function() {
        assert.equal(media._selectContainer.callCount, 0);
      });

      it('should call _detach with the specified container', function() {
        assert(media._detachContainers.calledWith([container]));
      });
    });
  });

  describe('_detachContainers', function() {
    it('should run _detachContainer for each container passed', function() {
      media = createMedia();
      media._detachContainer = sinon.spy();
      media._detachContainers(['foo', 'bar']);
      assert.equal(media._detachContainer.callCount, 2);
    });
  });

  describe('_getAllAttachedContainers', function() {
    it('should return an array with all containers in .attachments', function() {
      media = createMedia();
      media.attachments.set('foo', 'bar');
      media.attachments.set('baz', 'qux');

      assert.equal(media._getAllAttachedContainers().toString(), ['foo', 'baz'].toString());
    });
  });

  describe('_detachContainer', function() {
    var returnVal;

    before(function() {
      media = createMedia();
      var attachment = new Map();
      attachment.set('foo', 'bar');
      attachment.set('baz', 'qux');
      media.attachments.set('123', attachment);

      media._detachTrack = sinon.spy();
      returnVal = media._detachContainer('123');
    });

    context('when the container is attached', function() {
      it('should call _detachTrack for each track', function() {
        assert.equal(media._detachTrack.callCount, 2);
      });

      it('should return the passed element', function() {
        assert.equal(returnVal, '123');
      });

      it('should remove the container from .attachments', function() {
        assert(!media.attachments.has('123'));
      });
    });

    context('when the container is not attached', function() {
      before(function() {
        media._detachTrack = sinon.spy();
        returnVal = media._detachContainer('123');
      });

      it('should not call _detachTrack', function() {
        assert.equal(media._detachTrack.callCount, 0);
      });

      it('should return the passed element', function() {
        assert.equal(returnVal, '123');
      });
    });
  });
});

function TrackFactory(stream, track) {
  track.mediaStream = stream;
  return track;
}

function createMedia() {
  return new Media({
    AudioTrackFactory: TrackFactory,
    VideoTrackFactory: TrackFactory,
  });
}

function MediaStreamTrack(id, kind) {
  var track = new EventEmitter();

  Object.defineProperties(track, {
    id: { value: id },
    kind: { value: kind }
  });

  return track;
}
