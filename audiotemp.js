/* eslint-disable quotes */
/* eslint-disable no-console */
function printTrackSenderInfo(trackSender) {
  console.log("makarand: MediaTrackSender.id: ", trackSender.id);
  console.log('makarand: senders: ', trackSender._senders.size);
  console.log('makarand: clones: ', trackSender._clones.size);
  trackSender._clones.forEach(clone => {
    console.log("makarand: clone id:", clone.id);
    printTrackSenderInfo(clone);
  });
}

function printAudioTrackInfo(room) {
  const tracks = [...room.localParticipant.audioTracks.values()];
  const track = tracks[0].track;
  console.log("makarand: track.id: ", track.id);
  console.log("makarand: _didCallStop: ", track._didCallStop);
  console.log("makarand: _didCallEnd: ", track._didCallEnd);
  console.log("makarand: isEnabled: ", track.isEnabled);
  console.log("makarand: isStopped: ", track.isStopped);
  if (track._trackSender) {
    printTrackSenderInfo(track._trackSender);
  }
}

function foo(room) {
  console.log(room.name);
}