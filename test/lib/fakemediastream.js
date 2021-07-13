'use strict';

const EventTarget = require('../../es5/eventtarget');

const randomName = require('../lib/util').randomName;

class FakeMediaStream extends EventTarget {
  constructor() {
    const audioTracks = [];
    const videoTracks = [];

    super();
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
    let tracks = [];
    if (['audio', 'video'].includes(track.kind)) {
      tracks = this[`${track.kind}Tracks`];
    }
    const trackIdx = tracks.indexOf(track);
    if (0 <= trackIdx) {
      tracks.splice(trackIdx, 1);
    }
  }
}

class FakeMediaStreamTrack extends EventTarget {
  constructor(kind) {
    super();
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
      },
      readyState: {
        value: 'live',
        writable: true,
        enumerable: true
      }
    });
  }

  clone() {
    const clone = new FakeMediaStreamTrack(this.kind);
    clone.enabled = this.enabled;
    return clone;
  }

  stop() {
    this.readyState = 'ended';
    this.dispatchEvent({
      type: 'ended',
      target: this
    });
  }
}

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
