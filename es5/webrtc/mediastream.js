/* globals MediaStream */
'use strict';
if (typeof MediaStream === 'function') {
    module.exports = MediaStream;
}
else {
    module.exports = function MediaStream() {
        throw new Error('MediaStream is not supported');
    };
}
//# sourceMappingURL=mediastream.js.map