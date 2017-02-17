if (typeof window === 'undefined') {
  require('../lib/mockwebrtc')();
}

if (typeof Array.prototype.includes !== 'function') {
  Array.prototype.includes = function includes(x) {
    return this.indexOf(x) > -1;
  };
}

require('./spec/room');
require('./spec/connect');
require('./spec/participant');
