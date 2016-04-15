if (typeof window === 'undefined') {
  require('../lib/mockwebrtc')();
}

// require('./spec/conversation');
require('./spec/client');
require('./spec/signaling/v1/incominginvite');
require('./spec/signaling/v1/sipjsuseragent');
