if (typeof window === 'undefined') {
  require('../lib/mockwebrtc')();
}

require('./spec/conversation');
require('./spec/client');
require('./spec/invite');
require('./spec/signaling/sipjsuseragent');
