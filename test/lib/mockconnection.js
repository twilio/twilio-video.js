'use strict';

const EventTarget = require('../../lib/eventtarget');

class MockConnection extends EventTarget {
  constructor(type = null) {
    super();
    if (type) {
      this.type = type;
    }
  }
}

module.exports = MockConnection;
