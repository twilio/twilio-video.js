'use strict';

var randomName = require('./util').randomName;
var EventTarget = require('../../../lib/eventtarget');

class FakeMediaStream extends EventTarget {
  constructor() {
    super();
    Object.defineProperties(this, {
      audioTracks: { value: [] },
      videoTracks: { value: [] },
      id: { value: randomName(), enumerable: true }
    });
  }

  getAudioTracks() {
    return this.audioTracks;
  }

  getVideoTracks() {
    return this.videoTracks;
  }

  getTracks() {
    return this.audioTracks.concat(this.videoTracks);
  }

  addTrack(track) {
    if ('audio' === track.kind) {
      this.audioTracks.push(track);
    } else if ('video' === track.kind) {
      this.videoTracks.push(track);
    }
  }

  removeTrack(track) {
    var tracks = [];
    if (['audio', 'video'].includes(track.kind)) {
      tracks = this[track.kind + 'Tracks'];
    }
    var trackIdx = tracks.indexOf(track);
    if (0 <= trackIdx) {
      tracks.splice(trackIdx, 1);
    }
  }
}

class FakeMediaStreamTrack extends EventTarget {
  constructor(kind) {
    super();
    Object.defineProperties(this, {
      id: { value: randomName(), enumerable: true },
      kind: { value: kind, enumerable: true },
      label: { value: randomName(), enumerable: true },
      enabled: { value: true, writable: true, enumerable: true }
    });
  }

  stop() {
    this.dispatchEvent({ type: 'ended', target: this });
  }
}

function fakeGetUserMedia(constraints) {
  var fakeMediaStream = new FakeMediaStream();

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
