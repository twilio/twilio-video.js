/* eslint-disable no-undefined */
'use strict';

const assert = require('assert');
const { getUserMedia } = require('@twilio/webrtc');

const testPreflight = require('../../../lib/preflight');
const { audio: createLocalAudioTrack, video: createLocalVideoTrack } = require('../../../lib/createlocaltrack');
const createLocalTracks = require('../../../lib/createlocaltracks');
const LocalDataTrack = require('../../../lib/media/track/es5/localdatatrack');
const Room = require('../../../lib/room');
const { flatMap } = require('../../../lib/util');
const CancelablePromise = require('../../../lib/util/cancelablepromise');
const { createCodecMapForMediaSection, createPtToCodecName, getMediaSections } = require('../../../lib/util/sdp');
const TwilioError = require('../../../lib/util/twilioerror');

const {
  MediaConnectionError,
  SignalingConnectionError,
  TrackNameIsDuplicatedError,
  TrackNameTooLongError,
  MediaServerRemoteDescFailedError
} = require('../../../lib/util/twilio-video-errors');

const defaults = require('../../lib/defaults');
const { isChrome, isFirefox, isSafari } = require('../../lib/guessbrowser');
const { createRoom, completeRoom } = require('../../lib/rest');
const getToken = require('../../lib/token');

const {
  capitalize,
  combinationContext,
  isRTCRtpSenderParamsSupported,
  participantsConnected,
  pairs,
  randomName,
  setup,
  smallVideoConstraints,
  tracksSubscribed,
  tracksPublished,
  waitFor
} = require('../../lib/util');
const { resolve } = require('../../../lib/util/cancelablepromise');


describe('preflight', () => {
  it('works', () => {
    const [aliceToken, bobToken] = ['alice', 'bob'].map(identity => getToken(identity, { room: randomName() }));
    const preflight = testPreflight(aliceToken, bobToken);
    const deferred = {};
    deferred.promise = new Promise((resolve, reject) => {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });

    preflight.on('completed', report => {
      // eslint-disable-next-line no-console
      console.log(report);
      deferred.resolve();
    });

    return deferred;
  });
});

