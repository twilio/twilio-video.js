if (typeof window === 'undefined') {
  require('../lib/mockwebrtc')();
}

require('./spec/conversation');
require('./spec/client');
require('./spec/incominginvite');
require('./spec/signaling/sipjsuseragent');
