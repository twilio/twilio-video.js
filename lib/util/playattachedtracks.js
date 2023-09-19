export const playAllAttachedTracks = track => {
  const elements = Array.from(track._attachments.values());
  elements.forEach(el => el.play());
};
