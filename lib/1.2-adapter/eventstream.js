'use strict';

function EventStream() {
  if (!(this instanceof EventStream)) {
    return new EventStream();
  }
  return this;
}

EventStream.prototype.setup = function setup() {
  console.warn('EventStream is not supported in the 1.2-adapter version of twilio.js');
  return this;
};

EventStream.prototype.error = function error() {
  return this;
};

module.exports = EventStream;
