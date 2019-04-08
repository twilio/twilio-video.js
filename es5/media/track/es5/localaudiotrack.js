// TODO(mroberts): Remove this when we go to the next major version. This is
// only in place so that we can support ES6 classes without requiring `new`.
'use strict';

var _require = require('util'),
    inherits = _require.inherits;

var LocalAudioTrackClass = require('../localaudiotrack');

function LocalAudioTrack(mediaStreamTrack, options) {
  var track = new LocalAudioTrackClass(mediaStreamTrack, options);
  Object.setPrototypeOf(track, LocalAudioTrack.prototype);
  return track;
}

inherits(LocalAudioTrack, LocalAudioTrackClass);

module.exports = LocalAudioTrack;