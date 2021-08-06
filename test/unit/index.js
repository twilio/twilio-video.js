'use strict';

if (typeof window === 'undefined') {
  require('../lib/mockwebrtc')();
}

require('./spec/connect');
require('./spec/createlocaltrack');
require('./spec/createlocaltracks');
require('./spec/encodingparameters');
require('./spec/localparticipant');
require('./spec/networkqualityconfiguration');
require('./spec/room');
require('./spec/remoteparticipant');
require('./spec/queueingeventemitter');
require('./spec/statemachine');
require('./spec/transceiver');
require('./spec/twilioconnection');

require('./spec/data/transceiver');
require('./spec/data/sender');
require('./spec/data/receiver');
require('./spec/data/transport');

require('./spec/media/track/es5/localdatatrack');
require('./spec/media/track/audiotrack');
require('./spec/media/track/mediatrack');
require('./spec/media/track/localdatatrack');
require('./spec/media/track/localmediatrack');
require('./spec/media/track/localaudiotrack');
require('./spec/media/track/localvideotrack');
require('./spec/media/track/localtrackpublication');
require('./spec/media/track/receiver');
require('./spec/media/track/remotedatatrack');
require('./spec/media/track/remotemediatrack');
require('./spec/media/track/remotevideotrack');
require('./spec/media/track/remotetrackpublication');
require('./spec/media/track/sender');
require('./spec/media/track/transceiver');
require('./spec/media/track/videoprocessoreventobserver');
require('./spec/media/track/videotrack');

require('./spec/signaling/participant');
require('./spec/signaling/room');

require('./spec/signaling/v2');
require('./spec/signaling/v2/renderhintssignaling');
require('./spec/signaling/v2/mediasignaling');
require('./spec/signaling/v2/dominantspeakersignaling');
require('./spec/signaling/v2/cancelableroomsignalingpromise');
require('./spec/signaling/v2/icebox');
require('./spec/signaling/v2/localparticipant');
require('./spec/signaling/v2/networkqualitymonitor');
require('./spec/signaling/v2/networkqualitysignaling');
require('./spec/signaling/v2/recording');
require('./spec/signaling/v2/iceconnectionmonitor');
require('./spec/signaling/v2/remoteparticipant');
require('./spec/signaling/v2/room');
require('./spec/signaling/v2/peerconnection');
require('./spec/signaling/v2/peerconnectionmanager');
require('./spec/signaling/v2/localtrackpublication');
require('./spec/signaling/v2/remotetrackpublication');
require('./spec/signaling/v2/trackprioritysignaling');
require('./spec/signaling/v2/twilioconnectiontransport');

require('./spec/util');
require('./spec/util/asyncvar');
require('./spec/util/eventobserver');
require('./spec/util/documentvisibilitymonitor');
require('./spec/util/insightspublisher');
require('./spec/util/log');
require('./spec/util/movingaveragedelta');
require('./spec/util/networkmonitor');
require('./spec/util/sdp');
require('./spec/util/sdp/issue8329');
require('./spec/util/support');
require('./spec/util/trackmatcher/mid');
require('./spec/util/trackmatcher/ordered');
require('./spec/util/twilioerror');

require('./spec/webaudio/audiocontext');

require('./spec/stats/icereport');
require('./spec/stats/icereportfactory');
require('./spec/stats/peerconnectionreport');
require('./spec/stats/receiverreport');
require('./spec/stats/receiverreportfactory');
require('./spec/stats/senderreport');
require('./spec/stats/senderreportfactory');

require('./spec/stats/trackstats');
require('./spec/stats/localtrackstats');
require('./spec/stats/localaudiotrackstats');
require('./spec/stats/localvideotrackstats');
require('./spec/stats/remotetrackstats');
require('./spec/stats/remoteaudiotrackstats');
require('./spec/stats/remotevideotrackstats');
