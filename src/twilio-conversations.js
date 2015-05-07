'use strict';

global.Twilio = global.Twilio || new function Twilio(){ };

Twilio['Endpoint'] = require('../lib/endpoint');
Twilio['getUserMedia'] = require('../lib/media/stream').getUserMedia;
