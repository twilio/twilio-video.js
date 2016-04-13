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
require('./spec/conversation');
require('./spec/signaling/v1/incominginvite');
require('./spec/participant');
require('./spec/queueingeventemitter');
require('./spec/statemachine');
require('./spec/statsreporter');

require('./spec/media/index');
require('./spec/media/track');

require('./spec/signaling/conversation-info');

require('./spec/signaling/v1/dialog');
require('./spec/signaling/v1/sipjsdialog');
require('./spec/signaling/v1/sipjsuseragent');
require('./spec/signaling/v1/sipjsmediahandler');
require('./spec/signaling/v1/useragent');

require('./spec/signaling/v1/invitetransaction');
require('./spec/signaling/v1/sipjsinviteclienttransaction');
require('./spec/signaling/v1/sipjsinviteservertransaction');
require('./spec/signaling/v1/inviteclienttransaction');
require('./spec/signaling/v1/inviteservertransaction');

require('./spec/util/cancelablepromise');
require('./spec/util/index');
require('./spec/util/log');
require('./spec/util/multipart');
require('./spec/util/request');
require('./spec/util/twilioerror');

require('./spec/webrtc/getstatistics');

