For 1.x changes, go [here](https://github.com/twilio/twilio-video.js/blob/support-1.x/CHANGELOG.md).

2.0.0-beta13 (August 29, 2019)
==============================

New Features
------------

- You can now enable [DSCP tagging](https://tools.ietf.org/html/draft-ietf-tsvwg-rtcweb-qos-18) for media
  packets by setting a new ConnectOptions property `enableDscp` to `true`. DSCP tagging allows you to request
  enhanced QoS treatment for media packets from any firewall/routers that support this feature. Setting this
  option to `true` will request DSCP tagging for media packets on supported browsers (only Chrome supports this as of now).
  Audio packets will be sent with DSCP header value set to `0xb8` which corresponds to EF = Expedited Forwarding.
  Video packets will be sent with DSCP header value set to `0x88` which corresponds to AF41 = Assured Forwarding. (JSDK-2456)

  ```js
  const { connect } = require('twilio-video');
  const room = await connect(token, {
    enableDscp: true
  });
  ```

- The ConnectOptions flag `dscpTagging` which was introduced in 1.19.0 has now been renamed
  to `enableDscp`. Using the old name still works, but is deprecated and scheduled for removal. (JSDK-2492)

- Setting bandwidth limits for media using `LocalParticipant.setParameters()` will now no longer require a
  round of negotiation with the remote peer and will take effect instantaneously. (JSDK-2460)

Bug Fixes
---------

- Worked around a minor interop issue between Chrome/Safari Participants and Firefox 68+
  Participants in a Peer-to-Peer Room. Although this issue does no affect the normal
  functioning of the Room, it resulted in the Chrome/Safari Participants logging cryptic
  Error messages to the JavaScript console. Now, twilio-video.js will log warning messages
  until Chrome ([bug](https://bugs.chromium.org/p/chromium/issues/detail?id=978582)) and
  Safari fix this issue. (JSDK-2412)
- Fixed a bug where connecting to a Room with a `region` containing special characters in
  ConnectOptions failed with an Error other than [SignalingConnectionError](https://www.twilio.com/docs/api/errors/53000). (JSDK-2400)

2.0.0-beta12 (July 12, 2019)
============================

New Features
------------

- By default, you will subscribe to all RemoteTracks shared by other Participants in a Room.
  You can now override this behavior through a new ConnectOptions flag `automaticSubscription`.
  Setting it to `false` will make sure that you will not subscribe to any RemoteTrack in a Group or
  Small Group Room. Setting it to `true`, or not setting it at all preserves the default behavior.
  This flag does not have any effect in a Peer-to-Peer Room. (JSDK-2395)

  ```js
    const { connect } = require('twilio-video');
    const room = await connect(token, {
      automaticSubscription: false
    });
  ```

- twilio-video.js will now detect and attempt to recover from media disruptions
  quicker than before thereby improving the performance of the [Network Reconnection API](https://www.twilio.com/docs/video/reconnection-states-and-events). (JSDK-2337)

Bug Fixes
---------

- Fixed a bug where Participants in a Group or Small Group Room stopped receiving
  Dominant Speaker and Network Quality updates when the media server recovered
  from a failover. (JSDK-2307)
- Fixed a bug where, the local and remote AudioTracks' audioLevels returned by
  `Room.getStats()` were not in the range [0-32767]. (JSDK-2303)
- Fixed a bug where Chrome and Safari Participants were enabling simulcast for
  H264 LocalVideoTracks when VP8 simulcast was enabled. (JSDK-2321)

Developer Notes
---------------

- On October 12, 2018, the specification for the JavaScript Session Establishment
  Protocol (JSEP) was [updated](https://github.com/rtcweb-wg/jsep/pull/850) to remove
  MediaStreamTrack IDs from Unified Plan SDPs (Media Session Descriptions). twilio-video.js
  depends on MediaStreamTrack IDs to map WebRTC MediaStreamTracks to the corresponding
  RemoteAudioTracks and RemoteVideoTracks. With this release of twilio-video.js, we have
  added support for the updated JSEP specification for Firefox and Safari (twilio-video.js
  uses Plan B SDPs on Chrome). We highly recommend that you upgrade to this version so your
  application continues to work on Firefox and Safari even after they support the updated
  JSEP specification. We will provide a detailed advisory once we have more information
  about when they are planning to support the updated JSEP specification. (JSDK-2385)

2.0.0-beta11 (June 12, 2019)
============================

New Features
------------

- By default, twilio-video.js connects to your nearest signaling server, as determined by
  [latency based routing](https://www.twilio.com/docs/video/ip-address-whitelisting#signaling-communication).
  You can now override this behavior by using a new ConnectOptions flag called `region`. This will make
  sure that your signaling traffic will terminate in the specified region. (JSDK-2338)

  ```js
  const { connect } = require('twilio-video');
  const room = await connect(token, {
    region: 'de1'
  });
  ```

  This will guarantee that your signaling traffic will terminate in Germany. For other possible values
  for region, please refer to this [table](https://www.twilio.com/docs/video/ip-address-whitelisting#signaling-communication).
  If you specify an invalid value for `region`, `connect` will raise a [SignalingConnectionError](https://www.twilio.com/docs/api/errors/53000):

  ```js
  const { connect } = require('twilio-video');

  try {
    const room = await connect(token, {
      region: 'foo'
    });
  } catch (error) {
    assert.equal(error.code, 53000);
    assert.equal(error.message, 'Signaling connection error');
  }
  ```

Bug Fixes
---------

- Fixed a bug where Firefox Participants were not able to publish more than one
  LocalDataTrack after joining a Group Room. (JSDK-2274)
- Fixed a bug where Firefox Participants sometimes lost their media connections
  when they tried to publish a LocalDataTrack in a Group Room. (JSDK-2256)

2.0.0-beta10 (June 6, 2019)
===========================

Bug Fixes
---------

- Fixed a bug where Participants on Firefox 68 or above were unable to publish
  LocalAudioTracks or LocalVideoTracks. (JSDK-2381)

2.0.0-beta9 (May 2, 2019)
=========================

New Features
------------

- [Network reconnection](https://www.twilio.com/docs/video/reconnection-states-and-events),
  which was introduced as an opt-in feature in `twilio-video.js@2.0.0-beta6`, is now
  enabled by default. The temporary ConnectOptions flag `_useTwilioConnection` has
  been removed. If this flag is present in ConnectOptions, it will be ignored. (JSDK-2335)

2.0.0-beta8 (April 23, 2019)
============================

New Features
------------

- You can now use the [Network Quality API](https://www.twilio.com/docs/video/using-network-quality-api)
  to receive Network Quality levels for RemoteParticipants in a Group Room. You can
  also control the verbosity of the network quality information that is reported.
  A Participant will now have an additional property `networkQualityStats` which
  contains the network quality statistics used to calculate the `networkQualityLevel`. (JSDK-2255)

  You can specify the verbosity levels of the network quality information in ConnectOptions
  while joining the Room:

  ```js
  const { connect } = require('twilio-video');
  const room = await connect(token, {
    networkQuality: {
      local: 1, // Verbosity level for LocalParticipant [1 - 3]
      remote: 2 // Verbosity level for RemoteParticipants [0 - 3]
    }
  });

  // Set up reporting of network quality statistics for the LocalParticipant.
  setupNetworkQualityStats(room.localParticipant);

  // Set up reporting of network quality statistics for RemoteParticipants in the Group Room.
  room.participants.forEach(setupNetworkQualityStats);

  // Set up reporting of network quality statistics for RemoteParticipants that will join the Group Room.
  room.on('participantConnected', setupNetworkQualityStats);

  function logNetworkQualityStats(participant, networkQualityLevel, networkQualityStats) {
    console.log(`Network quality level for ${participant.identity}:`, networkQualityLevel);
    if (networkQualityStats) {
      // Verbosity is in the range [2 - 3].
      console.log('Network quality statistics used to compute the level:', networkQualityStats);
    }
  }

  function setupNetworkQualityStats(participant) {
    // Log current network quality statistics of the Participant.
    logNetworkQualityStats(participant, participant.networkQualityLevel, participant.networkQualityStats);
    // Listen to changes in the Participant's network quality level.
    participant.on('networkQualityLevelChanged', (networkQualityLevel, networkQualityStats) => {
      logNetworkQualityStats(participant, networkQualityLevel, networkQualityStats);
    });
  }
  ```

  You can also change the verbosity levels of the network quality information after
  joining the Room:

  ```js
  room.localParticipant.setNetworkQualityConfiguration({
    local: 3,
    remote: 1
  });
  ```

2.0.0-beta7 (April 1, 2019)
===========================

New Features
------------

- Added VP8 simulcast support for Safari 12.1 and above, which now supports VP8 along
  with H264. You will now be able to play back VP8 VideoTracks from Chrome and Firefox
  Participants in a Group Room. For more details, refer to these guides:
  [Developing for Safari](https://www.twilio.com/docs/video/javascript-v2-developing-safari-11)
  and [Working with VP8 Simulcast](https://www.twilio.com/docs/video/tutorials/working-with-vp8-simulcast). (JSDK-2315)

2.0.0-beta6 (March 15, 2019)
============================

New Features
------------
- [Dominant Speaker](https://www.twilio.com/docs/video/detecting-dominant-speaker)
  and [Network Quality](https://www.twilio.com/docs/video/using-network-quality-api)
  APIs are now generally available.
- twilio-video.js now supports versions of Safari that enable Unified Plan as the
  default SDP format. As of now, Unified Plan is enabled by default in the latest
  Safari Technology Preview. (JSDK-2306)
- Network reconnection is now supported as an opt-in feature. Previously, Participants
  would be disconnected from the Room during network disruptions or handoffs. This
  feature allows Participants to remain connected to the Room.

  To try this new feature in your application **you must perform the following steps**:

  1. Set the Time-To-Live (TTL) of your [AccessToken](https://www.twilio.com/docs/video/tutorials/user-identity-access-tokens)
     to the maximum allowed session duration, currently 14400 seconds (4 hours).
     This ensures that when a network loss occurs the client will be able to
     re-authenticate the reconnection. Note, a reconnection attempt with an expired
     AccessToken will result in an [AccessTokenExpiredError](https://www.twilio.com/docs/api/errors/20104).
  2. Ensure that the [AccessToken]((https://www.twilio.com/docs/video/tutorials/user-identity-access-tokens))
     does not contain a configuration profile sid. Configuration profiles were
     deprecated when we [announced](https://www.twilio.com/blog/2017/04/programmable-video-peer-to-peer-rooms-ga.html#room-based-access-control)
     the general availability of twilio-video.js@1.0.0. Configuration profiles are
     not supported when using this feature.
  3. Enable the feature using the temporary flag `_useTwilioConnection` as follows:

     ```js
     const { connect } = require('twilio-video');
     const room = await connect(token, {
       _useTwilioConnection: true
     });
     ```

  4. The reconnecting event will now raise a [SignalingConnectionDisconnectedError](https://www.twilio.com/docs/api/errors/53001)
     when a signaling connection network disruption occurs. Previously, the reconnecting
     event only raised a [MediaConnectionError](https://www.twilio.com/docs/api/errors/53405).
     You can differentiate between errors in the handler as follows:

     ```js
     room.on('reconnecting', error => {
       if (error.code === 53001) {
         console.log('Reconnecting your signaling connection!', error.message);
       } else if (error.code === 53405) {
         console.log('Reconnecting your media connection!', error.message);
       }
     });
     ```

  5. When a Participant closes the tab/browser or navigates away from your application,
     we recommend that you disconnect from the Room so that other Participants are
     immediately notified. You can achieve this as follows:

     ```js
     window.addEventListener('beforeunload', () => {
       room.disconnect();
     });
     ```

  6. If the reconnect attempt takes too long to complete due to network loss or
     latency issues, then you will be disconnected from the Room with a
     [ParticipantNotFoundError](https://www.twilio.com/docs/api/errors/53204).

  After twilio-video.js@2.0.0 is generally available, we plan to make this an opt-out
  feature in twilio-video.js@2.1.0, followed by removing our existing SIP-based
  signaling transport altogether in twilio-video.js@2.2.0.

Bug Fixes
---------

- Fixed a bug where `Room.getStats` was throwing a TypeError in Electron 3.x. (JSDK-2267)
- Fixed a bug where the LocalParticipant sometimes failed to publish a LocalTrack
  to a group Room due to media negotiation failure. (JSDK-2219)
- Removed workaround for this [Firefox bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1481335)
  on Firefox 65 and above. (JSDK-2280)
- Fixed a bug where passing invalid RTCIceServer urls in ConnectOptions did not
  raise a MediaConnectionError. (JSDK-2279)

2.0.0-beta5 (January 7, 2019)
=============================

New Features
------------

- `Room.getStats` on Firefox will now consume the spec-compliant `RTCIceCandidateStats`
  available in [versions 65 and above](https://www.fxsitecompat.com/en-CA/docs/2018/rtcicecandidatestats-has-been-updated-to-the-latest-spec/). (JSDK-2235)
- Participants will now be able to stay in the Room and recover their media
  connections if the media server becomes unresponsive, instead of being
  disconnected. (JSDK-2245)
- `Room.getStats` is now supported on versions of Safari that enable Unified Plan
  as the default SDP format. It is not supported on earlier versions due to this
  [Safari bug](https://bugs.webkit.org/show_bug.cgi?id=192601).
  We have updated the documentation to reflect this behavior. (JSDK-2201)
- `Room.getStats` on Chrome now uses the WebRTC 1.0 compliant version of the
  RTCPeerConnection's `getStats` API. (JSDK-2182)
- Worked around Firefox 63's [deprecation](https://blog.mozilla.org/webrtc/getstats-isremote-65/)
  of the `isRemote` property in `RTCInboundRTPStreamStats` and `RTCOutboundRTPStreamStats`. (JSDK-2222)

2.0.0-beta4 (November 29, 2018)
===============================

Bug Fixes
---------

  - Fixed a bug where, when a Safari Participant joins a Room after a Firefox Participant,
    it did not receive video frames for VideoTracks published by the Firefox Participant. (JSDK-2224)

2.0.0-beta3 (November 20, 2018)
===============================

Bug Fixes
---------

- Fixed a bug where unpublishing a LocalTrack from within one of its event
  listeners that have been added before publishing it to the Room throws a
  TypeError. (JSDK-2212)

Note for Electron developers
----------------------------

- twilio-video.js will no longer be usable on Electron 2.x or below. Please
  upgrade to Electron 3.x or higher.

2.0.0-beta2 (October 1, 2018)
=============================

Bug Fixes
---------

- Fixed a bug where calling a LocalVideoTrack's `stop` method did not stop the
  video capture, and thereby did not turn the camera light off. (JSDK-2156)
- Fixed a bug where calling LocalParticipant's `unpublishTrack` on a LocalTrack
  that was being published to a Room also stopped the LocalTrack. (JSDK-2169)

2.0.0-beta1 (August 10, 2018)
=============================

Breaking Changes
----------------

- Google Chrome, starting from version 72, will enable Unified Plan as the default
  SDP format. This version of twilio-video.js will choose Plan B as the SDP format
  in order to continue supporting Google Chrome versions 72 and above until Unified
  Plan support is added. For more details, please refer to this [advisory](https://support.twilio.com/hc/en-us/articles/360012782494-Breaking-Changes-in-Twilio-Video-JavaScript-SDKs-December-2018-).
- RemoteParticipant no longer emits the deprecated "trackAdded" and "trackRemoved"
  events. Use the "trackSubscribed" and "trackUnsubscribed" events instead.
- LocalParticipant no longer contains the deprecated `addTrack`, `addTracks`,
  `removeTrack` and `removeTracks` methods. Use `publishTrack`, `publishTracks`,
  `unpublishTrack`, and `unpublishTracks` instead.
- RemoteTrack no longer has the deprecated `id` property. Use the `sid` or `name`
  properties instead.
- RemoteTrack no longer has the deprecated `isSubscribed` property. Use the
  corresponding RemoteTrackPublication's `isSubscribed` property instead.
- RemoteTrack no longer emits the deprecated "unsubscribed" event. Use the
  corresponding RemoteTrackPublication's "unsubscribed" event instead.
- Participant's `trackPublications` collection is now renamed to `tracks`.
  Similarly, `audioTrackPublications` is now renamed to `audioTracks`,
  `dataTrackPublications` is now renamed to `dataTracks`, and
  `videoTrackPublications` is now renamed to `videoTracks`. Participant no
  longer maintains the deprecated Track-based collections.
- We removed support for Bower.
