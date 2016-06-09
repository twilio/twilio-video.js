if (typeof window === 'undefined') {
  require('../lib/mockwebrtc')();
}

require('./spec/conversation');
require('./spec/client');
