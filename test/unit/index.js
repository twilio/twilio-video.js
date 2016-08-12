'use strict';

if (typeof window === 'undefined') {
  require('../lib/mockwebrtc')();
}

if (typeof document === 'undefined') {
  var MockBrowser = require('mock-browser').mocks.MockBrowser;
  var browser = new MockBrowser();
  global.document = browser.getDocument();
}

require('./spec/client');
require('./spec/room');
require('./spec/localparticipant');
require('./spec/participant');
require('./spec/queueingeventemitter');
require('./spec/statemachine');

require('./spec/media/index');
require('./spec/media/track');
require('./spec/media/track/localtrack');

require('./spec/signaling/v2/cancelableroomsignalingpromise');
require('./spec/signaling/v2/icebox');
require('./spec/signaling/v2/remoteparticipant');
require('./spec/signaling/v2/room');
require('./spec/signaling/v2/peerconnection');
require('./spec/signaling/v2/peerconnectionmanager');
require('./spec/signaling/v2/track');

require('./spec/util/index');
require('./spec/util/log');
require('./spec/util/twilioerror');

require('./spec/webrtc/getstatistics');

