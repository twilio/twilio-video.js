"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.playAllAttachedTracks = void 0;
var playAllAttachedTracks = function (track) {
    var elements = Array.from(track._attachments.values());
    elements.forEach(function (el) { return el.play(); });
};
exports.playAllAttachedTracks = playAllAttachedTracks;
//# sourceMappingURL=playattachedtracks.js.map