'use strict';

const EventEmitter = require('events').EventEmitter;
const sinon = require('sinon');
const { inherits } = require('util');

function MockIceServerSource() {
  EventEmitter.call(this);
  this.isStarted = false;
  this.start = sinon.spy(this.start.bind(this));
  this.stop = sinon.spy(this.stop.bind(this));
}

inherits(MockIceServerSource, EventEmitter);

MockIceServerSource.prototype.start = function start() {
  this.isStarted = true;
  return Promise.resolve([]);
};

MockIceServerSource.prototype.stop = function stop() {
  this.isStarted = false;
};

module.exports = MockIceServerSource;
