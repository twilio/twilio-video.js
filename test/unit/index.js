'use strict';

if (typeof window === 'undefined') {
  require('../lib/mockwebrtc')();
}

if (typeof document === 'undefined') {
  var MockBrowser = require('mock-browser').mocks.MockBrowser;
  var browser = new MockBrowser();
  global.document = browser.getDocument();
}

if (typeof Array.prototype.includes !== 'function') {
  Array.prototype.includes = function includes(x) {
    return this.indexOf(x) > -1;
  };
}

require('./spec/connect');
require('./spec/createlocaltrack');
require('./spec/createlocaltracks');
require('./spec/ecs');
require('./spec/encodingparameters');
require('./spec/localparticipant');
require('./spec/room');
require('./spec/remoteparticipant');
require('./spec/queueingeventemitter');
require('./spec/statemachine');

require('./spec/iceserversource/constant');
require('./spec/iceserversource/nts');

require('./spec/media/track');
require('./spec/media/track/localtrack');
require('./spec/media/track/localtrackpublication');
require('./spec/media/track/remotetrack');

require('./spec/signaling/v2');
require('./spec/signaling/v2/cancelableroomsignalingpromise');
require('./spec/signaling/v2/icebox');
require('./spec/signaling/v2/recording');
require('./spec/signaling/v2/remoteparticipant');
require('./spec/signaling/v2/room');
require('./spec/signaling/v2/peerconnection');
require('./spec/signaling/v2/peerconnectionmanager');
require('./spec/signaling/v2/localtrackpublication');
require('./spec/signaling/v2/remotetrack');
require('./spec/signaling/v2/transport');

require('./spec/util/index');
require('./spec/util/insightspublisher');
require('./spec/util/log');
require('./spec/util/sdp');
require('./spec/util/twilioerror');

require('./spec/webaudio/audiocontext');

require('./spec/stats/trackstats');
require('./spec/stats/localtrackstats');
require('./spec/stats/localaudiotrackstats');
require('./spec/stats/localvideotrackstats');
require('./spec/stats/remotetrackstats');
require('./spec/stats/remoteaudiotrackstats');
require('./spec/stats/remotevideotrackstats');
