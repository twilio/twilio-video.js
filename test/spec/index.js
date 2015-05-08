if (typeof window === 'undefined') {
  require('../mockwebrtc')();
}

require('./useragent');
require('./sipjsuseragent');
require('./endpoint');
require('./conversation');
require('./invite');
require('./util').test();
require('./cancelablepromise');
