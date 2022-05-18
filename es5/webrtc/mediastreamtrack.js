/* global MediaStreamTrack */
'use strict';
if (typeof MediaStreamTrack === 'function') {
    module.exports = MediaStreamTrack;
}
else {
    module.exports = function MediaStreamTrack() {
        throw new Error('MediaStreamTrack is not supported');
    };
}
//# sourceMappingURL=mediastreamtrack.js.map