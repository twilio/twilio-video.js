var Q = require('q');

function InviteClientTransaction(ua, address, options) {
  var deferred = Q.defer();

  Object.defineProperties(this, {
    _deferred: { value: deferred },
    _promise: { value: deferred.promise }
  });
}

InviteClientTransaction.prototype.then = function then(onResolve, onReject) {
  return this._promise.then(onResolve, onReject);
};

InviteClientTransaction.prototype.cancel = function cancel() {
  var self = this;
  if(!this._promise.isFulfilled() && !this._promise.isRejected()) {
    self._deferred.reject(self);
  }
};

module.exports = InviteClientTransaction;
