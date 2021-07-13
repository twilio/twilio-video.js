'use strict';

const EventTarget = require('../../es5/eventtarget');

class MockConnection extends EventTarget {
  constructor(type = null) {
    super();
    if (type) {
      this.type = type;
    }
  }
}

module.exports = MockConnection;
