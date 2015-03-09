'use strict';

var Q = require('q');

function waitAll(promisesOrDeferreds, done) {
  promisesOrDeferreds = promisesOrDeferreds.map(function(pOrD) {
    return pOrD.promise ? pOrD.promise : pOrD;
  });
  return Q.all(promisesOrDeferreds).then(function() {
    done();
  }, done);
}

module.exports.waitAll = waitAll;
