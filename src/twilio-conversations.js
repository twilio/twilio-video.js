'use strict';

global.Twilio = global.Twilio || new function Twilio(){};

var _Endpoint = require('../lib/endpoint');

function Endpoint() {
  throw new Error("Cannot call Endpoint\'s constructor directly; instead call Twilio.Endpoint.createEndpointWithToken");
}

Endpoint.prototype = _Endpoint.prototype;

Endpoint.createWithToken = _Endpoint.createWithToken;

Twilio['Endpoint'] = Endpoint;
Twilio['getUserMedia'] = require('../lib/media/stream').getUserMedia;
