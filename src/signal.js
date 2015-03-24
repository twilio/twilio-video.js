'use strict';

global.Twilio = global.Twilio || new function Twilio(){};

var Twilio = global['Twilio'];
var Signal = Twilio['Signal'] = Twilio['Signal'] || new function Signal(){};

Signal['Endpoint'] = require('../lib/endpoint');
Signal['Stream'] = require('../lib/media/stream');
