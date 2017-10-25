'use strict';

function makeFakeLog() {
  const fakeLog = {
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
