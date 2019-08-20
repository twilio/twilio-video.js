// eslint-disable-next-line no-warning-comments
// TODO(mroberts): Remove this when we go to the next major version. This is
// only in place so that we can support ES6 classes without requiring `new`.
'use strict';

const { inherits } = require('util');

const LocalVideoTrackClass = require('../localvideotrack');

function LocalVideoTrack(mediaStreamTrack, options) {
  const track = new LocalVideoTrackClass(mediaStreamTrack, options);
  Object.setPrototypeOf(track, LocalVideoTrack.prototype);
  return track;
}

inherits(LocalVideoTrack, LocalVideoTrackClass);

module.exports = LocalVideoTrack;
