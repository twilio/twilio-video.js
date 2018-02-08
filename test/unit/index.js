'use strict';

if (typeof window === 'undefined') {
  require('../lib/mockwebrtc')();
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
require('./spec/transceiver');

require('./spec/data/transceiver');
require('./spec/data/sender');
require('./spec/data/receiver');

require('./spec/iceserversource/constant');
require('./spec/iceserversource/nts');

require('./spec/media/track/es5/localdatatrack');
require('./spec/media/track/mediatrack');
require('./spec/media/track/localdatatrack');
require('./spec/media/track/localmediatrack');
require('./spec/media/track/localtrackpublication');
require('./spec/media/track/receiver');
require('./spec/media/track/remotedatatrack');
require('./spec/media/track/remotemediatrack');
require('./spec/media/track/sender');
require('./spec/media/track/transceiver');

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

require('./spec/util');
require('./spec/util/insightspublisher');
require('./spec/util/log');
require('./spec/util/sdp');
require('./spec/util/sdp/issue8329');
require('./spec/util/trackmatcher/mid');
require('./spec/util/trackmatcher/ordered');
require('./spec/util/twilioerror');

require('./spec/webaudio/audiocontext');

require('./spec/stats/trackstats');
require('./spec/stats/localtrackstats');
require('./spec/stats/localaudiotrackstats');
require('./spec/stats/localvideotrackstats');
require('./spec/stats/remotetrackstats');
require('./spec/stats/remoteaudiotrackstats');
require('./spec/stats/remotevideotrackstats');
