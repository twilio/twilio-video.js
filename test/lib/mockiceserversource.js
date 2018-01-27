'use strict';

const EventEmitter = require('events').EventEmitter;
const sinon = require('sinon');
const { inherits } = require('util');

class MockIceServerSource {
  constructor() {
    EventEmitter.call(this);
    this.isStarted = false;
    this.start = sinon.spy(this.start.bind(this));
    this.stop = sinon.spy(this.stop.bind(this));
  }

  start() {
    this.isStarted = true;
    return Promise.resolve([]);
  }

  stop() {
    this.isStarted = false;
  }
}

inherits(MockIceServerSource, EventEmitter);

module.exports = MockIceServerSource;
