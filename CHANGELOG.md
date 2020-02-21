For 1.x changes, go [here](https://github.com/twilio/twilio-video.js/blob/support-1.x/CHANGELOG.md).

2.2.0 (February 21, 2020)
=========================

New Features
------------

- You will now be disconnected from a Room with a `MediaDTLSTransportFailedError` (error code 53407)
  when media cannot published to the Room due to a DTLS handshake failure. (JSDK-2552)
- Media reconnections are now time-bound. Now, if the media connection to the Room
  is not recovered after a certain time period, which is 30 seconds for now, then you
  will be disconnected from the Room with a `MediaConnectionError` (error code 53405). (JSDK-2552)

Bug Fixes
---------

- Fixed a bug where switching between networks (or connecting to VPN) sometimes caused media flow to stop. (JSDK-2667)
- Fixed a bug where twilio-video.js failed to load due to a TypeError on Chrome iOS. (JSDK-2670)

2.1.0 (February 4, 2020)
========================

New Features
------------

- A RemoteParticipant will now emit a "reconnecting" event when it is trying to
  re-establish its signaling connection to the Room after a network disruption/handoff.
  Once it has successfully reconnected to the Room, it will emit a "reconnected"
  event. (JSDK-2662)

  ```js
  function reconnecting(participant) {
    console.log(`${participant.identity} is rejoining the Room`);
    assert.equal(participant.state, 'reconnecting');
  }

  function reconnected(participant) {
    console.log(`${participant.identity} has rejoined the Room`);
    assert.equal(participant.state, 'connected');
  }

  room.on('participantConnected', participant => {
    participant.on('reconnecting', () => {
      reconnecting(participant);
    });

    participant.on('reconnected', () => {
      reconnected(participant);
    });
  });

  // You can also listen to these events at the Room level.
  room.on('participantReconnecting', participant => {
    reconnecting(participant);
  });

  room.on('participantReconnected', participant => {
    reconnected(participant);
  });
  ```

  *NOTE*: It can take up to 15 seconds for our signaling backend to detect that a
  RemoteParticipant's connection has been disrupted due to a network degradation or
  handoff. This is because we don't want to be too aggressive in attempting reconnections.
  We encourage you to reach out to us with any feedback you may have in terms of the
  effect of this delay on your application's user experience.

  The LocalParticipant will now also emit "reconnecting" and "reconnected" events
  when the local client is recovering/successfully recovered from a signaling connection
  disruption:

  ```js
  const { localParticipant } = room;

  localParticipant.on('reconnecting', () => {
    reconnecting(localParticipant);
  });

  localParticipant.on('reconnected', () => {
    reconnected(localParticipant);
  });
  ```

2.0.1 (January 21, 2020)
========================

New Features
------------

- `Video.isSupported` now returns `true` for [Chromium-based Edge](https://www.microsoftedgeinsider.com/). (JSDK-2633)
- Support for Safari is no longer experimental. Hence, twilio-video.js will not log
  a console warning in Safari 12.1+. (JSDK-2635)

Bug Fixes
---------

- Fixed a bug where Room.getStats() sometimes returned null stats in a Peer-to-Peer
  Room on Chrome 81+. (JSDK-2639)

2.0.0 (December 20, 2019)
=========================

2.0.0-beta16 has been promoted to 2.0.0 GA and Network Bandwidth Profile is also GA! Thank you to all our beta users and for all the feedback you sent us during the beta period.

About Twilio Video JS SDK 2.0
-----------------------------

Twilio Video Javascript SDK 2.0 introduces the [Track Priority](https://www.twilio.com/docs/video/tutorials/using-track-priority-api) API, [Network Bandwidth Profile](https://www.twilio.com/docs/video/tutorials/using-bandwidth-profile-api) API, [Reconnection States and Events](https://www.twilio.com/docs/video/reconnection-states-and-events), and the [Region Selection](https://www.twilio.com/docs/video/tutorials/video-regions-and-global-low-latency) API.

[Track Priority](https://www.twilio.com/docs/video/tutorials/using-track-priority-api) and [Network Bandwidth Profile](https://www.twilio.com/docs/video/tutorials/using-bandwidth-profile-api) API gives developers the ability to specify how bandwidth should be allocated between the video tracks. Furthermore, the three profiles, (“grid”, “collaboration”, and “presentation”), specify when tracks should be switched off (or not) to conserve bandwidth for the highest priority tracks.

The [Reconnection States and Events](https://www.twilio.com/docs/video/reconnection-states-and-events) will automatically attempt to reconnect when a transient network error is encountered.

With [Region Selection](https://www.twilio.com/docs/video/tutorials/video-regions-and-global-low-latency) API, the SDK will automatically connect to the lowest latency data center. This API can also be configured to connect to a specific data center for cases where compliance might be required.

If migrating from a 1.x version, please refer to our [migration guide](https://www.twilio.com/docs/video/migrating-1x-2x).

To get started with Twilio Video JS, check our [Getting Started Guide](https://www.twilio.com/docs/video/javascript-v2-getting-started)

2.0.0-beta16 (December 10, 2019)
================================

New Features
------------

- This release supports all the features of the [Track Priority and Bandwidth Profile APIs](https://www.twilio.com/docs/video/migrating-1x-2x#track-priority-and-bandwidth-profiles-group-rooms-only-private-beta).

- You can now specify the mode to control Track switch off behavior by specifying a
  property `trackSwitchOffMode` in BandwidthProfileOptions.
  `trackSwitchOffMode` can be set to one of
  - `detected`  - In this mode, RemoteVideoTracks are switched off only when network congestion
                is detected.
  - `predicted` - In this mode, RemoteVideoTracks are pro-actively switched off when network
                congestion is predicted by the bandwidth estimation mechanism. This mode
                is used by default if not specified.
  - `disabled`  - In this mode, RemoteVideoTracks will not be switched off. Instead tracks
                will be adjusted to lower quality. (JSDK-2549)

  ```js
  const { connect } = require('twilio-video');
  const room = await connect(token, {
    bandwidthProfile: {
      video: {
        dominantSpeakerPriority: 'high',
        maxTracks: 2,
        mode: 'collaboration'
        trackSwitchOffMode: 'detected' // possible values: "predicted", "detected" or "disabled".
      }
    }
  });
  ```

- You can now change the priority of an already published LocalTrack using a new method
  `setPriority` on the corresponding LocalTrackPublication. (JSDK-2442)

  ```js
  const localTrackPublication = await room.localParticipant.publishTrack(localTrack, {
    priority: 'high' // LocalTrack's publish priority - "low", "standard" or "high"
  });

  // After a while, change the priority to "low".
  localTrackPublication.setPriority(`low`);
  ```

  This will update `publishPriority` on all corresponding RemoteTrackPublications and
  emit a new event "publishPriorityChanged" to notify the user:

  ```js
  remoteTrackPublication.on('publishPriorityChanged', priority => {
    console.log(`The publisher has changed the priority this Track to "${priority}"`);
    assert.equal(remoteTrackPublication.publishPriority, priority);
  });

- In a **Group Room**, You can now override for yourself the priority of a RemoteTrack set by the publisher
   by using a new method `setPriority`. (JSDK-2347)

  ```js
    remoteTrack.setPriority('high');
  ```

- If you want to revert back to the priority set by the publisher, you can do so as shown below:

  ```js
    remoteTrack.setPriority(null);
  ```

Bug Fixes
---------
- Worked around an issue in chrome where it would sometimes stop sending updates on screen-share track if `maxVideoBitrate` was set for the track.
You can limit bitrates on outgoing tracks using [Localparticipant.setParameters](https://media.twiliocdn.com/sdk/js/video/releases/2.0.0-beta16/docs/LocalParticipant.html#setParameters__anchor) api. With this workaround, any bitrates set will not be applied to screen share track on chrome. (JSDK-2557)

- Fixed a race condition, that would sometimes cause a track to not get published if multiple tracks were added in quick succession (JSDK-2573)

- Fixed a bug where `publishPriorityChanged`, `trackDisabled` and `trackEnabled` events were getting fired for initial track state (JSDK-2603)

- Fixed an issue where loading twilio-video.js in firefox with `media.peerconnection.enabled` set to false in `about:config` caused page errors. (JSDK-2591)

2.0.0-beta15 (October 24, 2019)
===============================

New Features
------------

- twilio-video.js will now support the Unified Plan SDP format for Google Chrome. Google Chrome
  enabled Unified Plan as the default SDP format starting from version 72. In December 2018, we
  published an [advisory](https://support.twilio.com/hc/en-us/articles/360012782494-Breaking-Changes-in-Twilio-Video-JavaScript-SDKs-December-2018-)
  recommending customers to upgrade to the latest versions of twilio-video.js in order to not be
  affected by Google Chrome switching to Unified Plan starting from version 72. The way we ensured
  support of newer versions of Google Chrome in the versions of twilio-video.js released between
  December 2018 and now was by overriding the default SDP format to Plan B. Starting with this version,
  twilio-video.js will use Unified Plan where available, while also maintaining support for earlier
  browser versions with Plan B as the default SDP format. (JSDK-2312)

  **NOTE:**

  Since Unified Plan SDPs are usually larger than Plan B SDPs, this will lead to some increased signaling
  traffic whenever Participants join/leave a Room or publish/unpublish Tracks. Our load tests using Group
  Rooms with 35+ Participants revealed between 45% to 160% increase in peak signaling traffic. We did not
  notice any significant change in the media traffic. We also noticed about a 20% increase in peak CPU usage,
  which may be partly due to the browser having to process the larger Unified Plan SDPs. Please reach out to
  [support@twilio.com](mailto:support@twilio.com) to report any issues you may experience while adopting
  this release.

- Worked around a bug in [Chrome](https://bugs.chromium.org/p/chromium/issues/detail?id=749928)
  and Safari where browser continued to play WebRTC-based MediaStreamTrack even after
  corresponding `audio` element was removed from the DOM. With this fix twilio-video.js
  now disables any RemoteMediaTrack when it's not attached to any media elements. (JSDK-2490)

Bug Fixes
---------

- Fixed a bug where `Video.isSupported` evaluated to `true` on Chromium-based Edge browser,
  even though twilio-video.js does not support it at this moment. (JSDK-2515)

2.0.0-beta14 (September 17, 2019)
=================================

New Features
------------

- In a **Group Room**, you can now control how your available downlink bandwidth is
  distributed among the RemoteVideoTracks that you have subscribed to. twilio-video.js
  introduces the **Bandwidth Profile APIs**. Note that this feature is currently in
  **private beta** and hence will be **opt-in**. Please reach out to [video-product@twilio.com](mailto:video-product@twilio.com)
  for more information about how to enable these APIs for your Twilio Account.
  **Using these APIs in a Peer-to-Peer Room will have no effect**.

  ### Bandwidth Profile (private beta)

  You can now configure how your available downlink bandwidth will be distributed
  among your subscribed RemoteVideoTracks by using a new optional ConnectOptions
  parameter `bandwidthProfile`. For more details, please refer to the `BandwidthProfileOptions`
  [documentation](//media.twiliocdn.com/sdk/js/video/releases/2.0.0-beta14/docs/global.html#BandwidthProfileOptions).
  Here is an example:

  ```js
  const { connect } = require('twilio-video');
  const room = await connect(token, {
    bandwidthProfile: {
      video: {
        dominantSpeakerPriority: 'high', // Min. subscribe priority of Dominant Speaker's RemoteVideoTracks.
        maxSubscriptionBitrate: 150000, // Max. bandwidth (bps) to be allocated to subscribed RemoteVideoTracks.
        maxTracks: 3, // Max. number of visible RemoteVideoTracks. Other RemoteVideoTracks will be switched off.
        mode: 'collaboration', // Subscription mode: "collaboration", "grid" or "presentation".
        renderDimensions: {
          low: { // Desired render dimensions of RemoteVideoTracks with priority "low".
            width: 320,
            height: 240
          },
          standard: { // Desired render dimensions of RemoteVideoTracks with priority "standard".
            width: 640,
            height: 480
          },
          high: { // Desired render dimensions of RemoteVideoTracks with priority "high".
            width: 1080,
            height: 720
          }
        }
      }
    }
  });
  ```

  ### Track Priority (private beta)

  While publishing a LocalTrack, you can now optionally specify its publish priority
  in the following way:

  ```js
  const localTrackPublication = await room.localParticipant.publishTrack(localTrack, {
    priority: 'high' // LocalTrack's publish priority - "low", "standard" or "high"
  });

  // LocalTrackPublication has a new property "priority" which stores the publish
  // priority set while publishing the corresponding LocalTrack.
  assert.equal(localTrackPublication.priority, 'high');
  ```

  This signals to the media server the relative importance of this LocalTrack with respect
  to other Tracks that may be published to the Room. The media server takes this into
  account while allocating a subscribing RemoteParticipant's bandwidth to the corresponding
  RemoteTrack. If you do not specify a priority, then it defaults to `standard`.

  You can also find out about the priorities of RemoteTracks published by other
  RemoteParticipants by accessing a new property `publishPriority` on the corresponding
  RemoteTrackPublications:

  ```js
  remoteParticipant.on('trackPublished', remoteTrackPublication => {
    console.log(`RemoteParticipant published a Track with priority ${remoteTrackPublication.publishPriority}`);
  });
  ```

  ### Switching on/off RemoteVideoTracks (private beta)

  When a subscribing Participant's downlink bandwidth is insufficient, the media server
  tries to preserve higher priority RemoteVideoTracks by switching off lower priority
  RemoteVideoTracks, which will stop receiving media until the media server decides
  to switch them back on. You can now get notified about these actions by listening
  to the `switchedOff` and `switchedOn` events on the RemoteVideoTrack:

  ```js
  remoteTrackPublication.on('subscribed', remoteTrack => {
    remoteTrack.on('switchedOff', () => {
      // You can now determine whether a particular RemoteTrack is switched off.
      assert.equal(remoteTrack.isSwitchedOff, true);
      console.log(`The RemoteTrack ${remoteTrack.name} was switched off`);
    });

    remoteTrack.on('switchedOn', () => {
      assert.equal(remoteTrack.isSwitchedOff, false);
      console.log(`The RemoteTrack ${remoteTrack.name} was switched on`);
    });
  });
  ```

Bug Fixes
---------

- Fixed a bug where LocalVideoTracks were being published at a very low bitrate even
  when there was sufficient bandwidth to publish at higher bitrates. (JSDK-2509)

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
