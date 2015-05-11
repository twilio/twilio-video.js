'use strict';

var constants = require('../util/constants');
var util = require('../util');

function Sound(options) {
  if (!(this instanceof Sound)) {
    return new Sound(options);
  }
  options = util.withDefaults(options, constants.SOUNDS);
  var incoming = options['incoming'];
  var outgoing = options['outgoing'];
  var disconnect = options['disconnect'];
  var dtmf0 = options['dtmf0'];
  var dtmf1 = options['dtmf1'];
  var dtmf2 = options['dtmf2'];
  var dtmf3 = options['dtmf3'];
  var dtmf4 = options['dtmf4'];
  var dtmf5 = options['dtmf5'];
  var dtmf6 = options['dtmf6'];
  var dtmf7 = options['dtmf7'];
  var dtmf8 = options['dtmf8'];
  var dtmf9 = options['dtmf9'];
  var dtmfStar = options['dtmfStar'];
  var dtmfHash = options['dtmfHash'];
  incoming = incoming ? getOrCreate(incoming, true) : DISABLED;
  outgoing = outgoing ? getOrCreate(outgoing) : DISABLED;
  disconnect = disconnect ? getOrCreate(disconnect) : DISABLED;
  dtmf0 = dtmf0 ? getOrCreate(dtmf0) : DISABLED;
  dtmf1 = dtmf1 ? getOrCreate(dtmf1) : DISABLED;
  dtmf2 = dtmf2 ? getOrCreate(dtmf2) : DISABLED;
  dtmf3 = dtmf3 ? getOrCreate(dtmf3) : DISABLED;
  dtmf4 = dtmf4 ? getOrCreate(dtmf4) : DISABLED;
  dtmf5 = dtmf5 ? getOrCreate(dtmf5) : DISABLED;
  dtmf6 = dtmf6 ? getOrCreate(dtmf6) : DISABLED;
  dtmf7 = dtmf7 ? getOrCreate(dtmf7) : DISABLED;
  dtmf8 = dtmf8 ? getOrCreate(dtmf8) : DISABLED;
  dtmf9 = dtmf9 ? getOrCreate(dtmf9) : DISABLED;
  dtmfStar = dtmfStar ? getOrCreate(dtmfStar) : DISABLED;
  dtmfHash = dtmfHash ? getOrCreate(dtmfHash) : DISABLED;
  Object.defineProperties(this, {
    incoming: {
      value: incoming
    },
    outgoing: {
      value: outgoing
    },
    disconnect: {
      value: disconnect
    },
    dtmf0: {
      value: dtmf0
    },
    dtmf1: {
      value: dtmf1
    },
    dtmf2: {
      value: dtmf2
    },
    dtmf3: {
      value: dtmf3
    },
    dtmf4: {
      value: dtmf4
    },
    dtmf5: {
      value: dtmf5
    },
    dtmf6: {
      value: dtmf6
    },
    dtmf7: {
      value: dtmf7
    },
    dtmf8: {
      value: dtmf8
    },
    dtmf9: {
      value: dtmf9
    },
    dtmfStar: {
      value: dtmfStar
    },
    dtmfHash: {
      value: dtmfHash
    }
  });
  return Object.freeze(this);
}

var DISABLED = new Sample(new MockAudioElement());

var samples = {};

function getOrCreate(src, loop) {
  return src in samples
    ? samples[src]
    : samples[src] = new Sample(src, loop);
}

var defaultSound = null;

Sound.getDefault = function getDefault() {
  if (!defaultSound) {
    defaultSound = new Sound();
  }
  return defaultSound;
};

function Sample(srcOrAudio) {
  if (!(this instanceof Sample)) {
    return new Sample(srcOrAudio);
  }
  var audio = typeof srcOrAudio === 'string'
            ? createAudioElement(srcOrAudio)
            : srcOrAudio;
  Object.defineProperties(this, {
    audio: {
      value: audio
    }
  });
  return Object.freeze(this);
}

Sample.prototype.play = function play() {
  this.audio.currentTime = 0;
  this.audio.muted = false;
  this.audio.play();
  return this;
};

Sample.prototype.stop = function stop() {
  this.audio.muted = true;
  this.audio.pause();
  return this;
};

function MockAudioElement() {
  if (!(this instanceof MockAudioElement)) {
    return new MockAudioElement();
  }
  Object.defineProperties(this, {
    style: {
      value: {}
    }
  });
  return this;
}

MockAudioElement.prototype.pause = function pause() {
  // Do nothing
};

MockAudioElement.prototype.play = function play() {
  // Do nothing
};

// NOTE(mroberts): Should we instead load these in an iframe?
function createAudioElement(src, loop) {
  var audioElement = typeof document === 'undefined'
                   ? new MockAudioElement()
                   : document.createElement('audio');
  audioElement.muted = true;
  if (loop) {
    audioElement.loop = true;
  }
  audioElement.preload = 'auto';
  audioElement.src = src;
  audioElement.style.display = 'none';
  audioElement.pause();
  if (typeof document !== 'undefined') {
    var body = document.getElementsByTagName('body')[0];
    body.appendChild(audioElement);
  }
  return audioElement;
}

module.exports = Sound;
