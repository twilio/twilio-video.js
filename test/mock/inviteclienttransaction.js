'use strict';

var util = require('../../lib/util');

function InviteClientTransaction(ua, address, options) {
  var deferred = util.defer();

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
  self._deferred.reject(self);
};

module.exports = InviteClientTransaction;
