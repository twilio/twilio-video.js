'use strict';

var CancelablePromise = require('./util/cancelablepromise');

/**
 * Create a {@link CancelablePromise<Room>}.
 * @param {function(function(Array<LocalTrack>): CancelablePromise<RoomSignaling>):
 *   Promise<function(): CancelablePromise<RoomSignaling>>} getLocalTracks
 * @param {function(Array<LocalTrack>): LocalParticipant} createLocalParticipant
 * @param {function(Array<LocalTrack>): CancelablePromise<RoomSignaling>} createRoomSignaling
 * @param {function(LocalParticipant, RoomSignaling): Room} createRoom
 * @returns CancelablePromise<Room>
 */
function createCancelableRoomPromise(getLocalTracks, createLocalParticipant, createRoomSignaling, createRoom) {
  var cancelableRoomSignalingPromise = void 0;
  var cancelationError = new Error('Canceled');

  return new CancelablePromise(function onCreate(resolve, reject, isCanceled) {
    var localParticipant = void 0;
    getLocalTracks(function getLocalTracksSucceeded(localTracks) {
      if (isCanceled()) {
        return CancelablePromise.reject(cancelationError);
      }
      localParticipant = createLocalParticipant(localTracks);
      return createRoomSignaling(localParticipant).then(function createRoomSignalingSucceeded(getCancelableRoomSignalingPromise) {
        if (isCanceled()) {
          throw cancelationError;
        }
        cancelableRoomSignalingPromise = getCancelableRoomSignalingPromise();
        return cancelableRoomSignalingPromise;
      });
    }).then(function roomSignalingConnected(roomSignaling) {
      if (isCanceled()) {
        roomSignaling.disconnect();
        throw cancelationError;
      }
      resolve(createRoom(localParticipant, roomSignaling));
    }).catch(function onError(error) {
      reject(error);
    });
  }, function onCancel() {
    if (cancelableRoomSignalingPromise) {
      cancelableRoomSignalingPromise.cancel();
    }
  });
}

module.exports = createCancelableRoomPromise;