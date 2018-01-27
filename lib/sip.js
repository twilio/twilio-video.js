'use strict';

const toplevel = global.window || global;
const Transport = require('@twilio/sip.js/src/Transport');
const WebSocket = toplevel.WebSocket ? toplevel.WebSocket : require('ws');
const addEventListener = toplevel.addEventListener ? toplevel.addEventListener.bind(toplevel) : null;

module.exports = require('@twilio/sip.js/src/SIP')({
  addEventListener,
  console: toplevel.console,
  Promise: toplevel.Promise,
  WebSocket,
  timers: toplevel,
  Transport
});
