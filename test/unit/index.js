'use strict';

if (typeof window === 'undefined') {
  require('../lib/mockwebrtc')();
}

require('./spec/client');
require('./spec/conversation');
require('./spec/invite');
require('./spec/participant');
require('./spec/queueingeventemitter');
require('./spec/statsreporter');

require('./spec/media/index');
require('./spec/media/track');

require('./spec/signaling/conversationinfo');

require('./spec/signaling/dialog');
require('./spec/signaling/sipjsdialog');
require('./spec/signaling/sipjsuseragent');
require('./spec/signaling/sipjsmediahandler');
require('./spec/signaling/useragent');

require('./spec/signaling/invitetransaction/index');
require('./spec/signaling/invitetransaction/sipjsinviteclienttransaction');
require('./spec/signaling/invitetransaction/sipjsinviteservertransaction');
require('./spec/signaling/invitetransaction/inviteclienttransaction');
require('./spec/signaling/invitetransaction/inviteservertransaction');

require('./spec/util/cancelablepromise');
require('./spec/util/index');
require('./spec/util/log');
require('./spec/util/multipart');
require('./spec/util/request');
require('./spec/util/twilioerror');

require('./spec/webrtc/getstatistics');
