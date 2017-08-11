'use strict';

function makeFakeLog() {
  var fakeLog = {
    debug: () => {},
    deprecated: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  };

  fakeLog.createLog = () => fakeLog;
  return fakeLog;
}

module.exports = makeFakeLog();
