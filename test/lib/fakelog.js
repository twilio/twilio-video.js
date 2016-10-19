'use strict';

function makeFakeLog() {
  var fakeLog = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  };

  fakeLog.createLog = () => fakeLog;
  return fakeLog;
}

module.exports = makeFakeLog();
