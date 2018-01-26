'use strict';

var toplevel = global.window || global;
var Transport = require('@twilio/sip.js/src/Transport');
var WebSocket = toplevel.WebSocket ? toplevel.WebSocket : require('ws');
var addEventListener = toplevel.addEventListener ? toplevel.addEventListener.bind(toplevel) : null;

module.exports = require('@twilio/sip.js/src/SIP')({
  addEventListener,
  console: toplevel.console,
  Promise: toplevel.Promise,
  WebSocket,
  timers: toplevel,
  Transport
});
