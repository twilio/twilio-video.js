"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasDocumentPiP = void 0;
// eslint-disable-next-line
var supportsDocumentPiP = 'documentPictureInPicture' in window;
var hasDocumentPiP = function () {
    // eslint-disable-next-line
    return supportsDocumentPiP && !!documentPictureInPicture.window;
};
exports.hasDocumentPiP = hasDocumentPiP;
//# sourceMappingURL=documentPictureInPicture.js.map