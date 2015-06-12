if (typeof window === 'undefined') {
  require('../lib/mockwebrtc')();
}

require('./spec/conversation');
require('./spec/endpoint');
require('./spec/invite');
require('./spec/signaling/sipjsuseragent');
