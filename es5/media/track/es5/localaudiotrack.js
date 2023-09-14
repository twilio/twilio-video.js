// eslint-disable-next-line no-warning-comments
// TODO(mroberts): Remove this when we go to the next major version. This is
// only in place so that we can support ES6 classes without requiring `new`.
'use strict';
var inherits = require('../../../vendor/inherits');
var LocalAudioTrackClass = require('../localaudiotrack');
function LocalAudioTrack(mediaStreamTrack, options) {
    var track = new LocalAudioTrackClass(mediaStreamTrack, options);
    Object.setPrototypeOf(track, LocalAudioTrack.prototype);
    return track;
}
inherits(LocalAudioTrack, LocalAudioTrackClass);
module.exports = LocalAudioTrack;
//# sourceMappingURL=localaudiotrack.js.map