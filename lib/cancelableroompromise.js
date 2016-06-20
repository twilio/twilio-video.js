'use strict';

var CancelablePromise = require('./util/cancelablepromise');
var inherits = require('util').inherits;

/**
 * Construct a {@link CancelableRoomPromise}.
 * @class
 * @classdesc A {@link CancelableRoomPromise} is a Promise that can either
 *   resolve to {@link Room}, fail, or be canceled.
 * @extends CancelablePromise<Room>
 * @param {Array<string>} identities
 * @param {function(function(LocalMedia): CancelablePromise<RoomSignaling>):
 *   Promise<function(): CancelablePromise<RoomSignaling>>} getLocalMedia
 * @param {function(LocalMedia): CancelablePromise<RoomSignaling>} createRoomSignaling
 * @param {function(RoomSignaling): Room} createRoom
 */
function CancelableRoomPromise(getLocalMedia, createRoomSignaling, createRoom) {
  if (!(this instanceof CancelableRoomPromise)) {
    return new CancelableRoomPromise(getLocalMedia, createRoomSignaling, createRoom);
  }
  CancelablePromise.call(this);

  Object.defineProperties(this, {
    _cancelableRoomSignalingPromise: {
      writable: true,
      value: null
    }
  });

  var cancelationError = new Error('Canceled');
  var self = this;

  getLocalMedia(function getLocalMediaSucceeded(localMedia) {
    if (self._isCanceled) {
      throw cancelationError;
    }
    return createRoomSignaling(localMedia).then(function createRoomSignalingSucceeded(getCancelableRoomSignalingPromise) {
      if (self._isCanceled) {
        throw cancelationError;
      }
      self._cancelableRoomSignalingPromise = getCancelableRoomSignalingPromise();
      return self._cancelableRoomSignalingPromise;
    });
  }).then(function roomSignalingConnected(roomSignaling) {
    if (self._isCanceled) {
      roomSignaling.disconnect();
      throw cancelationError;
    }
    self._isCancelable = false;
    self._deferred.resolve(createRoom(roomSignaling));
  }).catch(function onError(error) {
    self._isCancelable = false;
    self._deferred.reject(error);
  });
}

inherits(CancelableRoomPromise, CancelablePromise);

CancelableRoomPromise.prototype._cancel = function _cancel() {
  if (this._cancelableRoomSignalingPromise) {
    this._cancelableRoomSignalingPromise.cancel();
  }
};

module.exports = CancelableRoomPromise;
