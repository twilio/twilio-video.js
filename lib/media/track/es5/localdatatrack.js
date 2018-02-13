// TODO(mroberts): Remove this when we go to the next major version. This is
// only in place so that we can support ES6 classes without requiring `new`.
'use strict';

const { inherits } = require('util');

const LocalDataTrackClass = require('../localdatatrack');

function LocalDataTrack(options) {
  const track = new LocalDataTrackClass(options);
  Object.setPrototypeOf(track, LocalDataTrack.prototype);
  return track;
}

inherits(LocalDataTrack, LocalDataTrackClass);

module.exports = LocalDataTrack;
