if (typeof window === 'undefined') {
  require('../lib/mockwebrtc')();
}

require('./spec/room');
require('./spec/client');
