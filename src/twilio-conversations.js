'use strict';

var Endpoint = require('../lib/endpoint');
var Stream = require('../lib/media/stream');
var getUserMedia = Stream.getUserMedia;

function Twilio() {
  Object.defineProperties(this, {
    Endpoint: {
      enumerable: true,
      value: Endpoint
    },
    getUserMedia: {
      enumerable: true,
      value: getUserMedia
    }
  });
  return this;
}

var twilio = global.Twilio = global.Twilio || new Twilio();
if (!twilio.Endpoint) {
  Twilio.call(global.Twilio);
}
