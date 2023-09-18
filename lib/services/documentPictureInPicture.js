// eslint-disable-next-line
const supportsDocumentPiP = 'documentPictureInPicture' in window;

export const hasDocumentPiP = () => {
  // eslint-disable-next-line
  return supportsDocumentPiP && !!documentPictureInPicture.window;
};
