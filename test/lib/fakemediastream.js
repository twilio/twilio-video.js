'use strict';

const inherits = require('util').inherits;

const EventTarget = require('../../lib/eventtarget');

const randomName = require('../lib/util').randomName;

function FakeMediaStream() {
  const audioTracks = [];
  const videoTracks = [];

  EventTarget.call(this);
  Object.defineProperties(this, {
    audioTracks: {
      value: audioTracks
    },
    videoTracks: {
      value: videoTracks
    },
    id: {
      value: randomName(),
      enumerable: true
    }
  });
}

inherits(FakeMediaStream, EventTarget);

FakeMediaStream.prototype.getAudioTracks =
  function getAudioTracks() {
    return this.audioTracks;
  };

FakeMediaStream.prototype.getVideoTracks =
  function getVideoTracks() {
    return this.videoTracks;
  };

FakeMediaStream.prototype.getTracks =
  function getTracks() {
    return this.audioTracks.concat(this.videoTracks);
  };

FakeMediaStream.prototype.addTrack =
  function addTrack(track) {
    if ('audio' === track.kind) {
      this.audioTracks.push(track);
    }
    else if ('video' === track.kind) {
      this.videoTracks.push(track);
    }
  };

FakeMediaStream.prototype.removeTrack =
  function removeTrack(track) {
    let tracks = [];
    if (['audio', 'video'].includes(track.kind)) {
      tracks = this[track.kind + 'Tracks'];
    }
    const trackIdx = tracks.indexOf(track);
    if (0 <= trackIdx) {
      tracks.splice(trackIdx, 1);
    }
  };

function FakeMediaStreamTrack(kind) {
  EventTarget.call(this);
  Object.defineProperties(this, {
    id: {
      value: randomName(),
      enumerable: true
    },
    kind: {
      value: kind,
      enumerable: true
    },
    label: {
      value: randomName(),
      enumerable: true
    },
    enabled: {
      value: true,
      writable: true,
      enumerable: true
    }
  });
}

inherits(FakeMediaStreamTrack, EventTarget);

FakeMediaStreamTrack.prototype.stop =
  function stop() {
    this.dispatchEvent({
      type: 'ended',
      target: this
    });
  };

function fakeGetUserMedia(constraints) {
  const fakeMediaStream = new FakeMediaStream();

  if (constraints.audio) {
    fakeMediaStream.addTrack(new FakeMediaStreamTrack('audio'));
  }
  if (constraints.video) {
    fakeMediaStream.addTrack(new FakeMediaStreamTrack('video'));
  }

  return Promise.resolve(fakeMediaStream);
}

module.exports = {
  FakeMediaStream: FakeMediaStream,
  FakeMediaStreamTrack: FakeMediaStreamTrack,
  fakeGetUserMedia: fakeGetUserMedia
};
