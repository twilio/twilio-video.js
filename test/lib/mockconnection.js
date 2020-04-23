'use strict';

const EventTarget = require('../../lib/eventtarget');

class MockConnection extends EventTarget {
  constructor() {
    super();
    this.type = 'whiz';
  }
}

module.exports = MockConnection;
