For 2.x changes, go [here](https://github.com/twilio/twilio-video.js/blob/master/CHANGELOG.md).

1.20.1 (February 6, 2020)
=========================

Bug Fixes
---------

- Fixed a bug where Room.getStats() sometimes returned null stats in a Peer-to-Peer
  Room on Chrome 81+. (JSDK-2640)

- Fixed a bug where sometimes enabling simulcast prevented media flow on screen share tracks on Chrome 81+. (JSDK-2658)

1.20.0 (November 11, 2019)
==========================

- As of this release, twilio-video.js will no longer use the deprecated Plan B SDP format when
publishing or subscribing to tracks. It will use the [Unified Plan](https://webrtc.org/web-apis/chrome/unified-plan/)
format. Google has advised that they will remove Plan B support from Chrome during Q1 2020. Therefore, we recommend
updating to SDK 1.20.0+ as soon as possible. This change will not impact interoperability with existing twilio-video.js
versions or other supported versions.

Bug Fixes
---------

- Fixed a bug where, the local and remote AudioTracks' audioLevels returned by
  `Room.getStats()` were not in the range [0-32767]. (JSDK-2318)
- Fixed a bug where `Video.isSupported` evaluated to `true` on Chromium-based Edge browser,
  even though twilio-video.js does not support it at this moment. (JSDK-2515)

1.19.2 (September 19, 2019)
===========================

Bug Fixes
---------

- Fixed a bug where LocalVideoTracks were being published at a very low bitrate even
  when there was sufficient bandwidth to publish at higher bitrates. (JSDK-2509)

1.19.1 (August 28, 2019)
========================

New Features
------------

- Previously in 1.19.0, we introduced a new ConnectOptions flag `dscpTagging` which set the DSCP
  header value for audio packets to `0xb8` (Expedited Forwarding - EF). Now, enabling this flag
  will also set the DSCP header value of video packets to `0x88` (Assured Forwarding - AF41). (JSDK-2488)

1.19.0 (August 21, 2019)
========================

New Features
------------

- You can now enable [DSCP tagging](https://tools.ietf.org/html/draft-ietf-tsvwg-rtcweb-qos-18) for audio
  packets on supported browsers (only Chrome supports this as of now) by setting a new ConnectOptions property
  `dscpTagging` to `true`. This will request enhanced QoS treatment for audio packets from any firewalls or
  routers that support this feature. Audio packets will be sent with DSCP header value set to `0xb8` which
  corresponds to EF (Expedited Forwarding). (JSDK-2440)

  ```js
  const { connect } = require('twilio-video');
  const room = await connect(token, {
    dscpTagging: true
  });
  ```

- Setting bandwidth limits for media using `LocalParticipant.setParameters()` will now no longer require a
  round of negotiation with the remote peer and will take effect instantaneously. (JSDK-2250)

Bug Fixes
---------

- Worked around a minor interop issue between Chrome/Safari Participants and Firefox 68+
  Participants in a Peer-to-Peer Room. Although this issue does no affect the normal
  functioning of the Room, it resulted in the Chrome/Safari Participants logging cryptic
  Error messages to the JavaScript console. Now, twilio-video.js will log warning messages
  until Chrome ([bug](https://bugs.chromium.org/p/chromium/issues/detail?id=978582)) and Safari
  fix this issue. (JSDK-2412)

1.18.2 (July 1, 2019)
=====================

Bug Fixes
---------

- Fixed a bug where in a Peer-to-Peer Room, a Firefox Participant's AudioTrack was
  not audible to a Chrome or Safari Participant if the Firefox Participant was the first
  to join the Room. (JSDK-2410)
- Fixed a bug where Participants in a Group or Small Group Room stopped receiving
  Dominant Speaker and Network Quality updates when the media server recovered
  from a failover. (JSDK-2307)

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
  about when they are planning to support the updated JSEP specification. (JSDK-2383)


1.18.1 (June 7, 2019)
=====================

Bug Fixes
---------

- Fixed a bug where Participants on Firefox 68 or above were unable to publish
  LocalAudioTracks or LocalVideoTracks. (JSDK-2381)

1.18.0 (April 23, 2019)
=======================

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

1.17.0 (April 1, 2019)
======================

New Features
------------

- Added VP8 simulcast support for Safari 12.1 and above, which now supports VP8 along
  with H264. You will now be able to play back VP8 VideoTracks from Chrome and Firefox
  Participants in a Group Room. For more details, refer to these guides:
  [Developing for Safari](https://www.twilio.com/docs/video/developing-safari-11)
  and [Working with VP8 Simulcast](https://www.twilio.com/docs/video/tutorials/working-with-vp8-simulcast). (JSDK-2314)

1.16.0 (March 18, 2019)
=======================

New Features
------------

- The [Dominant Speaker](https://www.twilio.com/docs/video/detecting-dominant-speaker)
  and [Network Quality](https://www.twilio.com/docs/video/using-network-quality-api)
  APIs are generally available.
- twilio-video.js will now support versions of Safari that enable Unified Plan as
  the default SDP format. As of now, Unified Plan is enabled by default in the
  latest Safari Technology Preview. (JSDK-2305)

Bug Fixes
---------

- Removed workaround for this [Firefox bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1481335) on Firefox 65 and above. (JSDK-2280)
- Fixed a bug where passing invalid RTCIceServer urls in ConnectOptions did not raise a MediaConnectionError. (JSDK-2279)

1.15.2 (February 7, 2019)
=========================

Bug Fixes
---------

- Fixed a bug where the LocalParticipant sometimes failed to publish a LocalTrack
  to a group Room due to media negotiation failure. (JSDK-2219)

1.15.1 (January 29, 2019)
=========================

Bug Fixes
---------

- Fixed a bug where, in Electron 2.x, if a RemoteParticipant published a second
  MediaTrack after publishing the first MediaTrack, calling `Room.getStats` did
  not return the RemoteTrackStatsReport for the second MediaTrack. (JSDK-2269)
- Fixed a bug where `Room.getStats` was throwing a TypeError in Electron 2.x and 3.x. (JSDK-2267)
- Fixed a bug where RemoteTrack subscription events were not firing in Electron 2.x. (JSDK-2266)

1.15.0 (January 11, 2019)
=========================

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

1.14.2 (December 5, 2018)
=========================

Bug Fixes
---------

- Fixed a bug where unpublishing a LocalTrack from within one of its event
  listeners that have been added before publishing it to the Room throws a
  TypeError. (JSDK-2212)
- Fixed a bug where, when a Safari Participant joins a Room after a Firefox Participant,
  it did not receive video frames for VideoTracks published by the Firefox Participant. (JSDK-2224)

1.14.1 (October 10, 2018)
=========================

Bug Fixes
---------

- Fixed a bug where twilio-video.js was internally using the deprecated
  RemoteTrack's `id` property. (JSDK-2173)

1.14.0 (August 28, 2018)
========================

New Features
------------

- Added a new property to ConnectOptions, `dominantSpeaker`, for enabling the
  Dominant Speaker API. Once the Dominant Speaker API is generally available,
  you will need to set the `dominantSpeaker` property to `true`. This will only
  take effect in Group Rooms.
- Added a new property to ConnectOptions, `networkQuality`, for enabling the
  Network Quality API. Once the Network Quality API is generally available,
  you will need to set the `networkQuality` property to `true`. This will only
  take effect in Group Rooms.

For example, here is how you can enable both APIs:

```js
connect(token, {
  dominantSpeaker: true,
  networkQuality: true
});
```

Please note that these features are still in beta and not generally available.

Bug Fixes
---------

- Fixed a bug where we erroneously raised deprecation warnings for "trackAdded"
  and "trackRemoved" events. (JSDK-2131)
- Reduced our usage of MediaStreams in Firefox. This should improve performance.
  (JSDK-2118)
- Worked around Firefox [Bug 1481335](https://bugzilla.mozilla.org/show_bug.cgi?id=1481335).
- Fixed a bug in our workaround for WebRTC
  [Issue 8329](https://bugs.chromium.org/p/webrtc/issues/detail?id=8329).

1.13.1 (August 7, 2018)
=======================

Bug Fixes
---------

- Worked around Firefox [Bug 1480277](https://bugzilla.mozilla.org/show_bug.cgi?id=1480277).

1.13.0 (July 30, 2018)
======================

New Features
------------

- When the Room is completed via the REST API, the Room emits a "disconnected"
  event with a TwilioError 53188, "Room completed". Previously, there was no way
  to distinguish this case from calling `disconnect` on the Room (JSDK-1884). In
  some applications, this will be expected, so you should set an event listener
  on the Room as follows:

  ```js
  room.once('disconnected', (room, error) => {
    if (!error) {
      console.log('You disconnected from the Room by calling `disconnect`');
      return;
    }
    switch (error.code) {
      case 53118:
        console.log('The Room was completed server-side');
        break;
      // Handle any other errors of interest.
      default:
        console.error(`You were disconnected: ${error.message}`);
        break;
    }
  });
  ```

1.12.0 (July 25, 2018)
======================

Changes to support Google Chrome 72+
------------------------------------

- Google Chrome, starting from version 72, will enable Unified Plan as the default
  SDP format. This version of twilio-video.js will choose Plan B as the SDP format
  in order to continue supporting Google Chrome versions 72 and above until Unified
  Plan support is added. For more details, please refer to this [advisory](https://support.twilio.com/hc/en-us/articles/360012782494-Breaking-Changes-in-Twilio-Video-JavaScript-SDKs-December-2018-).

Deprecations
------------

The following `1.x` APIs/events are now deprecated and scheduled for removal
in `twilio-video.js@2.0.0`:

- Participant's "trackAdded" and "trackRemoved" events
- RemoteTrack's `id` property
- RemoteTrack's `isSubscribed` property
- RemoteTrack's "unsubscribed" event

Please refer to the migration guide below for handling these deprecations.

Bug Fixes
---------

- Fixed a bug where publishing a LocalVideoTrack with VP8 simulcast enabled
  caused Chrome to crash. (JSDK-2032)
- Fixed a bug where we used deprecated `getStats` APIs in Firefox. (JSDK-1227)

Migration Guide
---------------

### Migrating from Participant's "trackAdded" and "trackRemoved" events

- On the LocalParticipant, these events indicated that a LocalTrack has been
  __scheduled to__ be added to or removed from a Room. Since calling
  `publishTrack` or `unpublishTrack` conveys the same information, we have
  deprecated these events.
- On the RemoteParticipant, you can use "trackSubscribed" and "trackUnsubscribed"
  events as drop-in replacements:

  ```js
  participant.on('trackSubscribed', track => {
    console.log(`Subscribed to a RemoteTrack: ${track}`);
  });

  participant.on('trackUnsubscribed', track => {
    console.log(`Unsubscribed from a RemoteTrack: ${track}`);
  });
  ```

### Migrating from RemoteTrack's deprecated properties and events

- Instead of the RemoteTrack's `id` property, use its `sid` or `name` property.
- Instead of the RemoteTrack's `isSubscribed` property, use the corresponding
  RemoteTrackPublication's `isSubscribed` property.
- Instead of listening to the RemoteTrack's "unsubscribed" event, listen to
  the corresponding RemoteTrackPublication's "unsubscribed" event:

  ```js
  publication.on('unsubscribed', track => {
    console.log(`Unsubscribed from a RemoteTrack: ${track}`);
  });
  ```

1.11.1 (July 3, 2018)
=====================

This release simply updates the dependency on @twilio/webrtc.

1.11.0 (July 3, 2018)
=====================

New Features
------------

- Participants now include a `networkQualityLevel` property that represents the
  quality of their connection to the Room. **This feature depends on server-side
  support, which we are rolling out gradually. As such, expect this value to
  always be `null` for the time being. We will make an announcement once
  the feature is enabled.** Participants will also emit a
  "networkQualityLevelChanged" event when this value changes. See the Network
  Quality Level Guide below for more information on this feature.
- Room now includes a `dominantSpeaker` property that represents the
  RemoteParticipant publishing the loudest RemoteAudioTrack your
  LocalParticipant is subscribed to, if any. Whenever the Dominant Speaker
  changes, Room emits the "dominantSpeakerChanged" event. **This feature depends
  on server-side support, which we are rolling out gradually. As such, expect
  this value to always be `null` for the time being. We will make an
  announcement once the feature is enabled.** This feature is currently
  unsupported in Peer-to-Peer (P2P) Rooms.
- Added a workaround for
  [WebKit Bug 180748](https://bugs.webkit.org/show_bug.cgi?id=180748), where, in
  Safari, `getUserMedia` may return a silent MediaStreamTrack. The workaround
  works by detecting the silence (this takes up to 250 ms) and retrying
  `getUserMedia` (up to 3 times). Enable it by setting the
  `workaroundWebKitBug180748` property to `true` in CreateLocalTrackOptions:

  ```js
  connect(token, { audio: { workaroundWebKitBug180748: true } });
  createLocalAudioTrack({ workaroundWebKitBug180748: true });
  createLocalTracks({ audio: { workaroundWebKitBug180748: true } });
  ```

Network Quality Level Guide
---------------------------

Participants (both LocalParticipants and RemoteParticipants) now include a
`networkQualityLevel` property that represents the quality of their connection
to the Room. This value is not always known. For example, in Peer-to-Peer (P2P)
Rooms, we do not compute it; therefore, the value is always `null`. We _will_
compute this value in Group Rooms, first for the LocalParticipant, and then for
the RemoteParticipants; however, this feature is being rolled out gradually, and
so we are shipping SDK changes ahead of the server-side changes.

If a Participant's Network Quality Level is known, then it has some value 0–5,
where 0 represents an unusable connection, 1 represents a very poor connection,
and 5 represents an excellent connection. While a Room is in the "reconnecting"
state, a LocalParticipant's `networkQualityLevel`, if it was being computed, is
set to 0.

### Example Usage

In this example, we print a string representing a Participant's Network Quality
Level as cell phone-style signal bars:

```js
function printNetworkQualityLevel(networkQualityLevel) {
  console.log({
    1: '▃',
    2: '▃▄',
    3: '▃▄▅',
    4: '▃▄▅▆',
    5: '▃▄▅▆▇'
  }[networkQualityLevel] || '');
}

// Print the initial Network Quality Level
printNetworkQualityLevel(participant.networkQualityLevel);

// Print changes to Network Quality Level
participant.on('networkQualityLevelChanged', printNetworkQualityLevel);
```

Bug Fixes
---------

- Fixed a bug where subscribing to or unsubscribing from a RemoteTrack using
  the Track Subscription REST API did not emit "trackSubscribed" or
  "trackUnsubscribed" events on the RemoteParticipant. (JSDK-2031)

- Fixed a bug where if a Firefox or Safari Participant gets disconnected from a
  group Room due to duplicate identity error, a "disconnected" event is
  emitted on the Room without the corresponding TwilioError. (JSDK-1931)

- Fixed a bug where calling `removeTracks` attempted to call `stop` on a
  LocalDataTrack, resulting in an error (LocalDataTrack does not have a `stop`
  method). (JSDK-2063)

1.10.0 (May 30, 2018)
=====================

New Features
------------

- A RemoteParticipant now maintains a collection of RemoteTrackPublications in a
  new `.trackPublications` property. It also maintains kind-specific
  RemoteTrackPublication collections (`.audioTrackPublications`,
  `.dataTrackPublications` and `.videoTrackPublications`). A "trackPublished"
  event is emitted on the RemoteParticipant (and subsequently on the Room) whenever
  a Track is published. A "trackUnpublished" event is emitted on the RemoteParticipant
  whenever a Track is unpublished. (JSDK-1438)

  ```js
  participant.on('trackPublished', publication => {
    console.log('A new Track was published!', publication);
    assert.equal(participant.trackPublications.get(publication.trackSid), publication);
  });

  participant.on('trackUnpublished', publication => {
    console.log('A new Track was unpublished!', publication);
    assert(!participant.trackPublications.has(publication.trackSid));
  });
  ```

- Added `trackSid` to TrackStats, so now, when you call `getStats` on a Room,
  the TrackStats will include Track SIDs for local and remote Tracks.
  (JSDK-1716)

Bug Fixes
---------

- Fixed a bug that cause `remoteAudioTrackStats` and `remoteVideoTrackStats` to
  always be empty Arrays in Firefox. (JSDK-1927)
- LogLevel was accidentally omitted from the API docs. (JSDK-1701)

RemoteTrackPublication Guide
----------------------------

A RemoteTrackPublication represents a Track that was published to the Room by
a RemoteParticipant.

```js
publication.on('subscribed', track => {
  console.log('Subscribed to Track', track);
  assert.equal(publication.isSubscribed, true);
  assert.equal(publication.track, track);
});

publication.on('subscriptionFailed', error => {
  console.error('Subscription failed', error);
  assert.equal(publication.isSubscribed, false);
  assert.equal(publication.track, null);
});

publication.on('trackDisabled', () => {
  console.log('Track disabled');
  assert.equal(publication.isTrackEnabled, false);
});

publication.on('trackEnabled', () => {
  console.log('Track enabled');
  assert.equal(publication.isTrackEnabled, true);
});

publication.on('unsubscribed', track => {
  console.log('Unsubscribed from Track', track);
  assert.equal(publication.isSubscribed, false);
  assert.equal(publication.track, null);
});
```

1.9.0 (May 9, 2018)
===================

New Features
------------

- Room now emits "reconnecting" and "reconnected" events when the media
  connection is disconnected and reconnected. You can use these events to update
  your application and warn your users when a reconnection is occurring.
  twilio-video.js does not yet support reconnecting the signaling connection;
  however, when we do, we will use this same event. We recommend you set the
  following event listeners in your application:

  ```js
  room.on('reconnecting', error => {
    // Warn and/or update your application's UI.
    console.warn('Reconnecting!', error);
  });

  room.on('reconnected', () => {
    // Log and/or update your application's UI.
    console.log('Reconnected!');
  });
  ```

  In addition to this change, we've also added a new Room `state` value:
  "reconnecting". Room `state` can now be one of "connected", "reconnecting", or
  "disconnected". (JSDK-1855)

- By default, twilio-video.js waits up to 3000 milliseconds to fetch ICE servers
  before connecting to a Room; and, if fetching ICE servers takes longer than
  3000 milliseconds or otherwise fails, twilio-video.js will fallback to using
  hard-coded STUN servers. Now you can configure this timeout with a new
  property in ConnectOptions, `iceServersTimeout`. You can also disable the
  fallback behavior by setting another new property in ConnectOptions,
  `abortOnIceServersTimeout`, to `true`. Doing so will cause the Promise
  returned by `connect` to reject with TwilioError 53500, "Unable to acquire
  configuration", if fetching ICE servers times out or otherwise fails.

Bug Fixes
---------

- Fixed a bug where, if the WebSocket connection to Twilio was disconnected (for
  example, due to losing internet connectivity), Room would emit a
  "disconnected" event without an error. Now, Room will emit a
  SignalingConnectionDisconnectedError.
- Fixed a bug where twilio-video.js failed to identify a WebSocket timeout in a
  timely manner. Now, WebSocket timeouts can be identified in around 30 seconds.
  If a WebSocket timeout occurs, for example, due to a WebSocket disconnect,
  Room will emit a "disconnected" event with SignalingConnectionTimeoutError.
- If an ICE failure occurs, for example due to disconnecting a VPN, but the
  signaling connection remains online, twilio-video.js will attempt an ICE
  restart to repair the media connection. (JSDK-1810)

1.8.0 (February 9, 2018)
========================

New Features
------------

- Added support for TURN over TLS on port 443.

1.7.0 (January 9, 2018)
=======================

New Features
------------

- Added VP8 simulcast support for Chrome. VP8 simulcast can be enabled in Chrome
  using the `preferredVideoCodecs` property in ConnectOptions. For example,

  ```js
  connect(token, {
    preferredVideoCodecs: [
      { codec: 'VP8', simulcast: true }
    ]
  });
  ```

  We recommend you only enable this setting in Group Rooms.

- By default, when you connect to a Group Room, you subscribe to all
  RemoteParticipants' Tracks. However, sometimes your device may lack the codec
  required to decode a particular Track. For example, an H.264-only Safari
  Participant would be unable to decode a VP8 VideoTrack. In these cases, we now
  raise a new event, "trackSubscriptionFailed", on the RemoteParticipant who
  published the Track you could not subscribe to. For example, the following
  code

  ```js
  room.participants.forEach(handleParticipant);
  room.on('participantConnected', handleParticipant);

  function handleParticipant(participant) {
    participant.on('trackSubscriptionFailed', (error, trackPublication) =>
      console.warn('Failed to subscribe to RemoteTrack %s with name "%s": %s',
        trackPublication.trackSid, trackPublication.trackName, error.message)));
  }
  ```

  will log something like

  > Failed to subscribe to RemoteTrack MTxxx with name "123": No codec supported

  to the console. twilio-video.js will also log these warnings by default.
  Please refer to the API docs for more information.

Bug Fixes
---------

- Fixed a memory leak in an internal dependency, SIP.js.

1.6.1 (December 12, 2017)
=========================

Bug Fixes
---------

- Fixed a bug where, if you published a LocalDataTrack, unpublished it, and then
  published it again, you would be unable to `send` data over it again.
  (JSDK-1580)
- We've worked around a long-standing issue with Firefox's RTCIceTransport
  behavior that required you to always add a LocalAudioTrack. You should now be
  able to connect to Rooms with, for example, only a LocalVideoTrack, only a
  LocalDataTrack, or no LocalTracks at all.
- Binary RemoteDataTrack messages received in Firefox arrived as Blobs instead
  of ArrayBuffers (as in Chrome and Safari). We now set the underlying
  RTCDataChannel's `binaryType` to "arraybuffer" in order to ensure consistent
  behavior across browsers. (JSDK-1627)
- We always stringify `name`s passed via LocalTrackOptions now. (JSDK-1565)
- Added a workaround for WebRTC
  [Issue 8329](https://bugs.chromium.org/p/webrtc/issues/detail?id=8329). This
  issue caused Track failures in Chrome whenever participating in Rooms from a
  device that supported duplicate codecs (for example, H.264 at two different
  profile levels). (JSDK-1645)
- Fixed some code that could lead to a renegotiation loop in Firefox.
- Fixed a memory leak in an internal class, PeerConnectionV2.

1.6.0 (October 24, 2017)
========================

New Features
------------

- Added DataTrack support in Group Rooms. Previously, DataTracks only worked in
  Peer-to-peer Rooms. Now they work in both. Consequently, the "experimental"
  warning has been removed.
- Added LocalDataTrackOptions. These options allow you to configure the
  `maxPacketLifeTime`, `maxRetransmits`, and `ordered` properties of a
  LocalDataTrack's underlying RTCDataChannel(s).
- Added "trackPublicationFailed" and "trackPublished" events to the
  LocalParticipant. Previously, if you failed to publish a LocalTrack when
  connecting to a Room, there was no API to discover what went wrong. Now, if
  you fail to publish a LocalTrack at `connect`-time—for example, due to a codec
  mismatch or an invalid Track name—we will raise a "trackPublicationFailed" on
  the LocalParticipant with an informative error. Similarly, if publication
  succeeds, we will raise a "trackPublished" event with the resulting
  LocalTrackPublication.
- Added a new top-level boolean property, `isSupported`, that indicates whether
  or not the browser/environment/platform currently running twilio-video.js
  contains the necessary APIs (for example, WebRTC) to participate in video
  chats. Depending on how you use twilio-video.js, you can use one of the
  methods below to access it:

  ```js
  // Option 1: Using `require`
  const { isSupported } = require('twilio-video');

  // Option 2: Using browser global
  const { isSupported } = Twilio.Video;
  ```

1.5.1 (October 13, 2017)
========================

Bug Fixes
---------

- Fixed a bug where we created too many MediaStreams in Firefox, leading to
  extremely degraded audio quality. (JSDK-1588)

1.5.0 (October 9, 2017)
=======================

New Features
------------

- You can now specify Track names. Refer to the Track name guide below for more
  information.

Bug Fixes
---------

- Fixed bug where RemoteTrack's "unsubscribed" event and RemoteParticipant's
  "trackUnsubscribed" event fired before the RemoteTrack was removed from the
  RemoteParticipant's `tracks` collections instead of after.

Track Name Guide
----------------

### Setting Track names

There are a few different ways you can specify Track names. For example, you can
specify `name` as an `audio` or `video` constraint when calling any of
`createLocalTracks`, `createLocalAudioTrack`, `createLocalVideoTrack`, or
`connect`:

```js
createLocalTracks({
  audio: { name: 'microphone' },
  video: { name: 'camera' }
});

createLocalAudioTrack({ name: 'microphone' });
createLocalVideoTrack({ name: 'camera' });

connect(token, {
  audio: { name: 'microphone' },
  video: { name: 'camera' }
});
```

These will create a LocalAudioTrack and a LocalVideoTrack with the names
"microphone" and "camera", respectively. If you have a reference to a
MediaStreamTrack, you can also pass the `name` to the LocalAudioTrack or
LocalVideoTrack constructor:

```js
const localAudioTrack = new LocalAudioTrack(mediaStreamTrack1, { name: 'microphone' });
const localVideoTrack = new LocalVideoTrack(mediaStreamTrack2, { name: 'camera' });
```

Similarly, for LocalDataTracks:

```js
const localDataTrack = new LocalDataTrack({ name: 'data' });
```

You can even pass these values if you use the MediaStreamTrack override for
`publishTrack`. For example:

```js
room.localParticipant.publishTrack(mediaStreamTrack, { name: 'my-track' });
```

Please keep in mind:

* If you do not specify a Track name, the Track's name will default to the
  LocalTrack ID.
* A single Participant cannot have two Tracks published with the same name at a
  time.

### Getting Track names

You can check a LocalTrack or RemoteTrack's name by querying it's `name`
property. For example,

```js
participant.on('trackSubscribed', track => {
  console.log('Subscribed to Track "' + track.name + '"');
});
```

This can be useful, for example, for distinguishing between a RemoteVideoTrack
named "camera" and a RemoteVideoTrack named "screenshare".

1.4.0 (October 2, 2017)
=======================

This release includes a handful of new features as well as some deprecations.
Please refer to the migration guide below for handling the deprecations.

New Features
------------

- Added `publishTrack`, `unpublishTrack`, and related methods to
  LocalParticipant. `addTrack`, `removeTrack` and related methods are now
  deprecated. Refer to the migration guide below.
- Added "trackSubscribed" and "trackUnsubscribed" events. As of now, they are
  emitted before and after the "trackAdded" and "trackRemoved" events,
  respectively; however, in a future release, they will only be emitted when
  a Track which has actually been subscribed to or unsubscribed from.
- Added LocalTrackPublication classes. These classes allow you to discover your
  Track SID, and, in a future release, will allow you to selectively subscribe
  to or unsubscribe from RemoteTracks. It is also recommended that you starting
  using Track SIDs instead of Track IDs to correlate Tracks.
- Added experimental DataTrack support. You can see a demo of it
  [here](https://github.com/twilio/draw-with-twilio). Refer to the DataTrack
  guide below for more information.

Migration Guide
---------------

### Migrating from `addTrack` to `publishTrack`

`addTrack` is deprecated and will be removed in the next major version. Please
migrate to `publishTrack` as soon as possible. For the most part, you can treat
the new method as a drop-in replacement for the old one. For example, where you
previously had

```js
// Before
room.localParticipant.addTrack(localTrack);
```

you can replace it with

```js
// After
room.localParticipant.publishTrack(localTrack);
```

One short-coming of `addTrack` is that it could not tell if it was successful or
not. With `publishTrack`, we actually return a Promise for a
LocalTrackPublication. If publishing succeeds, you'll be able to print your
Track SID:

```js
try {
  const publication = await room.localParticipant.publishTrack(track);
  console.log('Successfully published Track %s', publication.trackSid);
} catch (error) {
  console.error('Failed to publish Track!', error.message);
}
```

Similarly, `addTracks` has been replaced by `publishTracks`.

### Migrating from `removeTrack` to `unpublishTrack`

Like `addTrack` and `publishTrack`, `removeTrack` is deprecated and has been
replaced with `unpublishTrack`. For the most part, you can treat the new method
as a drop-in replacement for the old one. The one caveat is that
`unpublishTrack` will not automatically stop the Track for you. For example,
where you previously had

```js
// Before
room.localParticipant.removeTrack(localTrack);
```

you can replace it with

```js
// After
room.localParticipant.unpublishTrack(localTrack);
localTrack.stop();
```

Of course, you can omit the call to `stop` if you do not want to stop the Track.

`unpublishTrack` will return the LocalTrackPublication if the Track was
unpublished. For example, you can print the unpublished Track's SID:

```js
const publication = room.localParticipant.unpublishTrack(localTrack);
if (publication) {
  console.log('Successfully unpublished Track %s', publication.trackSid);
}
```

Alternatively, if you already have a reference to a LocalTrackPublication, you
can call `unpublish` directly on it.

```js
publication.unpublish();
```

Similarly, `removeTracks` has been replaced by `unpublishTracks`.

### Migrating from Track IDs to Track SIDs

In some applications, it makes sense to share metadata about a Track.
Previously, the natural way to do this with twilio-video.js was to use the Track
ID; however, in the next major release of twilio-video.js, Track IDs will be
replaced by Track SIDs. SIDs—or "string identifiers"—are identifiers that Twilio
assigns to resources. These identifiers are useful for debugging, sharing
metadata out-of-band, and looking up resources in the REST API. For a long time,
Rooms and Participants have had SIDs, but not Tracks. That changes in this
release.

Whereas before you may have associated metadata with a LocalTrack's ID, you
should now associate that metadata with the LocalTrack's SID, as exposed by the
LocalTrackPublication:

```js
// Before
room.localParticipant.addTrack(localTrack);
console.log('Added LocalTrack %s', localTrack.id);

// After
const publication = await room.localParticipant.publishTrack(localTrack);
console.log('Published LocalTrack %s', publication.trackSid);
```

Similarly, for a RemoteTrack:

```js
// Before
console.log('Received RemoteTrack %s', remoteTrack.id);

// After
console.log('Received RemoteTrack %s', remoteTrack.sid);
```

DataTrack
---------

This releases adds experimental support for "DataTracks". DataTracks are a new
kind of Track, similar to AudioTracks and VideoTracks. DataTracks are different,
though, in that they allow you to send and receive arbitrary data within a
Room—not just audio and video. Using DataTracks, you could send mouse events,
transfer files, or implement a simple chat mechanism in your Room. All of this
is supported under-the-hood by WebRTC's RTCDataChannels.

We're calling support for DataTracks "experimental" in this release becase, at
the time of writing, they are currently only supported in Peer-to-Peer (P2P)
Rooms. You will not (yet) be able to connect to Group Rooms with DataTracks. We
plan to add this in a subsequent release. If you want to see a demo of
DataTracks in action, see [here](https://github.com/twilio/draw-with-twilio).

Constructing a new DataTrack is simple—just call the LocalDataTrack
constructor:

```js
const { LocalDataTrack } = require('twilio');

const localTrack = new LocalDataTrack();
```

Once you've constructed a DataTrack, you can either `connect` to a Room with it
or publish it to a Room:

```js
// Option 1
connect(token, { tracks: [localTrack] });

// Option 2
room.localParticipant.publishTrack(localTrack);
```

Once you've published the DataTrack to the Room, call `send` to transmit
messages:

```js
localTrack.send('cool');
```

In order to receive a DataTrack, you'll want to iterate over a
RemoteParticipant's Tracks and listen to the "trackAdded" event. Once you
have a DataTrack, attach a listener to the "message" event:

```js
function handleTrack(remoteTrack) {
  if (remoteTrack.kind === 'data') {
    remoteTrack.on('message', data => {
      console.log('Got message "%s" from DataTrack %s', data, remoteTrack.sid);
    });
  }
}

remoteParticipant.tracks.forEach(handleTrack);
remoteParticipant.on('trackAdded', handleTrack);
```

You can also listen for the "trackMessage" on the RemoteParticipant:

```js
remoteParticipant.on('trackMessage', (data, remoteTrack) => {
  console.log('Got message "%s" from DataTrack "%s"', data, remoteTrack.sid);
});
```

1.3.0 (September 11, 2017)
==========================

New Features
------------

- twilio-video.js now features an API for setting and updating bandwidth
  constraints. When you `connect` to a Room, you can specify an optional
  `maxAudioBitrate` and an optional `maxVideoBitrate`, both in bits per second
  (bps). These values are set as hints for variable bitrate codecs, but will not
  take effect for fixed bitrate codecs.

  For example, to connect with a maximum audio bitrate of 64 kilobits per
  second and a maximum video bitrate of 500 kilobits per second:

  ```js
  const room = await connect(token, {
    maxAudioBitrate: 64000,
    maxVideoBitrate: 500000
  });
  ```

  You can also update your `maxAudioBitrate` and `maxVideoBitrate` while
  participating in a Room. For example, to reset your maximum bitrates for audio
  and video, you could set each to `null`:

  ```js
  room.localParticipant.setParameters({
    maxAudioBitrate: null,
    maxVideoBitrate: null
  });
  ```

  If you want to change only one value—for example, just the maximum video
  bitrate—you can omit the other value. For example, to update only the maximum
  video bitrate, leaving the maximum audio bitrate unchanged:

  ```js
  room.localParticipant.setParameters({ maxVideoBitrate: 1000000 });
  ```

- twilio-video.js now features an API for setting preferred codecs when
  publishing Tracks. When you `connect` to a Room, you can specify an optional
  `preferredAudioCodecs` array and an optional `preferredVideoCodecs` array.
  These are codec "preferences" because they will only be applied if your
  browser and the type of Room you are connected to support them. If a
  preference cannot be satisfied, we will fallback to the next best codec.

  For example, to connect with a preferred video codec of H.264:

  ```js
  const room = await connect(token, {
    preferredVideoCodecs: ['H264']
  });
  ```

  You can also specify more than one preferred codec. For example, to connect
  with a preferred audio codec of iSAC, falling back to Opus if iSAC is
  unavailable:

  ```js
  const room = await connect(token, {
    preferredAudioCodecs: ['isac', 'opus']
  });
  ```

Please refer to the API docs for more information on both of these features.

Bug Fixes
---------

- Track's `attach` method now sets the `playsInline` attribute on &lt;audio&gt;
  and &lt;video&gt; elements. This is necessary to allow playback in Safari 11
  on iOS.

1.2.2 (August 22, 2017)
=======================

This is primarily a bug fix release; however, we've also factored out two
dependencies (@twilio/sip.js and @twilio/webrtc) for easier management of the
project.

Bug Fixes
---------

- In Chrome, `Room#getStats()` did not provide valid values for those Participants
  with more than one Track of the same kind (audio or video). (JSDK-1329)
- Fixed a rare scenario where the SDK could "get stuck" negotiating with the
  server. We are evaluating whether or not to patch this behavior server-side
  as well, so that older clients can receive the fix, too. (JSDK-1454)

1.2.1 (August 14, 2017)
=======================

In addition to the following bug fixes, this release introduces experimental
support for Safari 11 and newer. Support for Safari is "experimental" because,
at the time of writing, Safari does not support VP8. This means you may
experience codec issues in Group Rooms. You may also experience codec issues in
Peer-to-Peer (P2P) Rooms containing Android- or iOS-based Participants who do
not support H.264. However, P2P Rooms with browser-based Participants should
work.

We are also experimenting with the ability to specify the set of codecs a Group
Room supports. This would allow you to create an H.264-only Group Room, for
example. Please email [video-product@twilio.com](mailto:video-product@twilio.com)
if you would like to try this out.

twilio-video.js will log these same caveats as a warning if you call `connect`
in Safari 11. You can disable this warning by setting the `logLevel` to "warn".

Bug Fixes
---------

- In Firefox, we were raising a `peerIdentity` TypeError in the console.
  (JSDK-1372)

1.2.0 (July 21, 2017)
=====================

New Features
------------

- Video Insights can be enabled or disabled by setting `insights` to `true` or
  `false` in the ConnectOptions. `insights` defaults to `true`. We recommend to
  leave Video Insights enabled in order to aid troubleshooting.

Bug Fixes
---------

- Added some missing documentation to ConnectOptions and
  CreateLocalTracksOptions. Both options objects accept `audio` and `video`
  properties which may be set to a boolean or
  [MediaTrackConstraints](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints).
  We added this to the documentation. (JSDK-1365)
- Fixed a bug where twilio-video.js would continue polling for configuration
  data, despite being disconnected from a Room and despite the Access Token
  having expired. (JSDK-1407)

1.1.0 (July 12, 2017)
=====================

New Features
------------

- You can now call the LocalParticipant's `removeTracks` method with an
  optional second boolean argument `stop` to specify whether the removed
  LocalTacks should be stopped. If `stop` is not specified, then the removed
  LocalTracks will be stopped. This mirrors the behavior of the LocalParticicipant's
  `removeTrack` method.

  ```js
  // Stops the removed LocalTracks
  localParticipant.removeTracks(tracks);
  localParticipant.removeTracks(tracks, true);
  ```

  ```js
  // Does not stop the removed LocalTracks
  localParticipant.removeTracks(tracks, false);
  ```

Bug Fixes
---------

- twilio-video.js can now be used alongside adapter.js. twilio-video.js checks
  whether or not an RTCPeerConnection implementation supports the "track" event
  by checking for an `ontrack` property on the RTCPeerConnection. adapter.js
  sets this property; however it only dispatches "track" events _if_ a function
  is assigned to the `ontrack` property, meaning that event handlers attached
  with `addEventListener` will never fire. We now work around this issue by
  assigning a function to `ontrack`.

1.0.0 (April 25, 2017)
======================

1.0.0-beta7 has been promoted to 1.0.0!

This library uses [Semantic Versioning](http://semver.org/): We've removed the
pre-release identifier, and we're proud to share the first generally available
release of twilio-video.js.

1.0.0-beta7 (April 21, 2017)
============================

Bug Fixes
---------

- The first known issue in 1.0.0-beta6 stems from a behavior in Chrome: Chrome
  will treat an SSRC change for a MediaStreamTrack as adding and removing the
  MediaStreamTrack; this caused a problem in our SDK, as the first
  MediaStreamTrack would be raised to the user wrapped in a Track object, but
  would eventually become unusable due to the SSRC change. We workaround this
  behavior by "fixing" the SSRCs announced in an SDP between calls to
  `createOffer`. Firefox does not exhibit this behavior. (CSDK-1206)
- Calling `addTrack`, `removeTrack`, or their plural variants in the same tick
  could lead to sending more messages than necessary; we landed an optimization
  to reduce these additional messages. (JSDK-1257)

1.0.0-beta6 (April 20, 2017)
============================

New Features
------------

- You can now `connect` to a Room using an Array of MediaStreamTracks without
  constructing LocalAudioTracks or LocalVideoTracks. For example, if you
  already have a reference to a MediaStream, `stream`, you can call

  ```js
  connect(token, { tracks: stream.getTracks() });
  ```

- You can now call LocalParticipant's `addTrack` and `removeTrack` methods
  with a MediaStreamTrack. If successful, these methods return the LocalTrack
  added or removed; otherwise, they return `null`.

- Added two new methods to LocalParticipant, `addTracks` and `removeTracks`, for
  adding and removing multiple LocalTracks at a time. These methods accept
  either an Array of LocalTracks or MediaStreamTracks, and return an Array of
  the LocalTracks added or removed. For example, if you already have a reference
  to a MediaStream, `stream`, you can call

  ```js
  localParticipant.addTracks(stream.getTracks());

  localParticiapnt.removeTracks(stream.getTracks());
  ```

Bug Fixes
---------

- Fixed a bug where attempting to remove a LocalTrack from the LocalParticipant
  after disconnecting from a Room threw an Error (JSDK-1233)
- Fixed a regression between 1.0.0-beta4 and 1.0.0-beta5 where
  automatically-acquired LocalTracks were not stopped after disconnecting from
  the Room
- Fixed a bug that could lead to media- and Track-related failures that
  resulting from the way we handle out-of-order SDP offers and answers; now,
  all PeerConnections will wait until an initial round of negotiation is
  complete before applying or creating subsequent offers (JSDK-1176)
- Fixed a bug where calling `cancel` on the CancelablePromise returned by
  `connect` could throw an Error
- Fixed a bug in the LocalAudioTrack and LocalVideoTrack constructors: `options`
  should have been optional (JSDK-1251)
- Fixed a bug where Room's `getStats` method could reject if outbound statistics
  were missing in Firefox
- Fixed a bug where Room's `getStats` method could reject if called after
  disconnecting from a Room in Firefox
- Fixed a bug in our message retry logic that caused us to retry messages after
  disconnecting from a Room

Known Issues
------------

- Despite the addition of `addTracks`, adding multiple LocalTracks in quick
  succession is likely to cause media failures, and so it is recommended to
  either

  - Stagger the addition or removal of LocalTracks, or
  - Use the `enable` and `disable` functionality in lieu of adding and removing
    LocalTracks.

  A solution has been identified and will be included in the next release.

- There exists an interoperability issue between Firefox and other WebRTC
  implementations (including Chrome and Twilio's iOS and Android SDKs) that can
  cause media failures if Firefox does not share a LocalAudioTrack. If you are
  developing an application that will interoperate with Firefox, please ensure
  you always share a LocalAudioTrack until this issue is resolved. You can
  share a muted LocalAudioTrack by calling `disable`. For example,

  ```js
  localAudioTrack.disable();
  ```

1.0.0-beta5 (March 20, 2017)
============================

We are very close to releasing the 1.0.0 APIs. This release includes a number of
simplifications to the twilio-video APIs, namely

- The Client class has been removed. Instead of constructing a Client using an
  Access Token and then calling `connect` on it, you can simply call `connect`
  and pass it an Access Token directly. For example,

  ```js
  const { connect } = require('twilio-video');

  const room = await connect('your-token');
  ```

  Or, if using browser globals,

  ```js
  const room = await Twilio.Video.connect('your-token');
  ```

- The Media and LocalMedia classes have been removed. Although the Media and
  LocalMedia classes provided some convenience methods for automatically
  attaching and detaching Tracks from the DOM as they were added and removed,
  these APIs got in the way whenever you wanted to do something more interesting
  with the Tracks. Therefore, the `audioTracks` and `videoTracks` collections as
  well as the `addTrack` and `removeTrack` methods have been moved up to the
  Participant and LocalParticipant levels. You should update your code to use
  the Track-level `attach` and `detach` APIs exclusively. For example,

  ```js
  function handleParticipant(participant) {
    participant.tracks.forEach(addTrack);
    participant.on('trackAdded', addTrack);
  }

  function addTrack(track) {
    const element = track.attach();
    document.body.appendChild(element);
  }
  ```

- The `getLocalMedia` method has also been replaced with a new method,
  `createLocalTracks`. This method behaves like `getLocalMedia` did, except it
  returns an Array of LocalTracks.

- The `addMicrophone` and `addCamera` methods from LocalMedia have been replaced
  with two new top-level methods, `createLocalAudioTrack` and
  `createLocalVideoTrack`.

Refer to the API docs for more information.

New Features
------------

- LocalTracks now indicate whether or not they have stopped with the `isStopped`
  property. They also emit a new event, "stopped". LocalParticipant re-emits
  this event as "trackStopped".
- LocalAudioTracks and LocalVideoTracks can now be constructed directly from
  MediaStreamTracks.
- Updated the Track-level `attach` APIs to allow attaching both an AudioTrack
  and a VideoTrack to the same HTMLMediaElement.


Bug Fixes
---------

- Fixed a bug where twilio-video.js, when used in Firefox, would not raise a
  "trackAdded" event on a remote Participant if they added, removed, and added
  back the same Track
- Fixed a bug where round-trip times reported by `getStats` were accidentally
  multiplied by 1000
- Fixed a bug where certain identities with non-ASCII characters could not be
  used (for example, multiple ":" characters were causing failures)
- Fixed a bug where minified builds of twilio-video.js could not be used on web
  pages that did not specify a charset
- Fixed an EventEmitter leak in StateMachine that was warning in the console

1.0.0-beta4 (January 25, 2017)
==============================

New Features
------------

- We've begun formalizing our error codes. They are divided up into Signaling
  (530xx), Room (531xx), Participant (532xx), Track (533xx), Media (534xx), and
  Configuration (535xx) subranges. Instances of TwilioError will now carry a
  numeric `code` belonging to one of these ranges.

Bug Fixes
---------

- The way that twilio-video.js's dependencies, including some of
  twilio-video.js's transitive dependencies, were declared caused problems with
  bundlers like Webpack. This resulted in issues trying to use twilio-video.js
  in certain configurations with Angular, Meteor, and React apps. This release
  updates those dependencies.

1.0.0-beta3 (December 8, 2016)
==============================

New Features
------------

- Improved logging for Client, Room, Participant, Media, and Track.
- Added a Room-level `isRecording` property which indicates whether or not the
  Room is being recorded (if recording is not currently enabled for your
  account, this property will always be false)
- Added Room-level "recordingStarted" and "recordingStopped" events which
  indicate when recording is started or stopped on the Room (if recording is not
  currently enabled for your account, these events will never fire)
- Added the ability to pass MediaTrackConstraints to LocalMedia's `addCamera`
  and `addMicrophone` methods
- Added a Room-level `getStats` method for returning Track-level media
  statistics

Bug Fixes
---------

- Worked around a Promise-subclassing issue in CancelablePromise that caused
  twilio-video.js to fail when used with Zone.js (and Angular)
- Fixed a bug where, if a VideoTrack belonged to a MediaStream containing
  multiple VideoTracks, the attach method might render a different VideoTrack
  than intended

1.0.0-beta2 (October 14, 2016)
==============================

This release was created to remove a file that was accidentally uploaded to the
NPM registry. The file included credentials (API Keys) to a test Twilio account
and were revoked when discovered.

1.0.0-beta1 (October 3, 2016)
=============================

In this release, the SDK has been renamed twilio-video.js and replaces the
earlier twilio-conversations.js. twilio-video.js offers the following
improvements over twilio-conversations.js:

- Conversations have been replaced with Rooms, which provide a simpler call
  model.
- OutgoingInvites and IncomingInvites are no longer required to join a video
  session, and they have been removed from the API.
- A new subclass of Participant, LocalParticipant, has been added.

All other classes including Client, Participant, Media, and Tracks remain
relatively unchanged. If you are loading twilio-video.js in the browser using
a &lt;script&gt; tag, the exported global has been renamed to `Twilio.Video`.

New Features
------------

- Use `connect` to connect to a Room. This method replaces the
  `inviteToConversation` method from twilio-conversations.js.
- You can `connect` to a Room as its sole Participant.
- You can specify the name of the Room you want to `connect` to by setting the
  `to` parameter.

Refer to the API docs for the full set of features.

Bug Fixes
---------

- A number of stability improvements have been made in the transition away from
  invites towards a Room-based model.

0.13.10 (October 3, 2016)
=========================

Bug Fixes
---------

- Fixed a bug where "trackAdded" events would not be raised for a Participant
  invited with `inviteToConversation` in Firefox (JSDK-932).
- Fixed a bug where `isStarted` was always false and "trackStarted" events were
  never raised in Firefox (JSDK-950).

0.13.9 (July 26, 2016)
======================

Bug Fixes
---------

- Reverted a change that altered the expected behavior of IncomingInvite: The
  caller will now auto-cancel the invite after 50 seconds, at which point the
  callee's IncomingInvite will emit the "canceled" event
- Fixed a bug where IncomingInvite was never emitting the "failed" event

0.13.8 (June 11, 2016)
======================

Bug Fixes
---------

- Fixed Track playback on Chrome 48 for Android (JSDK-661)

0.13.7 (June 17, 2016)
======================

Bug Fixes
---------

- Fixed a bug that duplicated Track events when the same LocalTrack was removed
  and readded (JSDK-574)
- Fixed a strict mode error that affected Safari (JSDK-692)

0.13.6 (June 6, 2016)
=====================

New Features
------------

- Added the ability to access the version of the SDK from
  `Twilio.Conversations.version` (or `Conversations.version` in Node)
- Improved Track playback support for Chrome on Android (JSDK-582)
- twilio-common.js is now bundled in distribution builds of the SDK. You no
  longer need to include it in a separate &lt;script&gt; tag (JSDK-626).

Bug Fixes
---------

- Silenced deprecation warnings in Firefox regarding `getUserMedia` and ICE
  server `urls` (JSDK-642)

0.13.5 (March 16, 2016)
=======================

New Features
------------

- Added the ability to set `iceTransportPolicy` in the Client constructor, in
  the `inviteToConversation` method, and in IncomingInvite's `accept` method;
  in supported browsers, this property allows you to restrict ICE candidates to
  relay-only (JSDK-424); note that this property only works in Chrome at the
  time of release
- Added the ability to set `iceServers` in the Client constructor, in the
  `inviteToConversation` method, and in IncomingInvite's `accept` method;
  setting this property overrides any `iceServers` returned by the Network
  Traversal Service, as configured in your Client's Configuration Profile
  (JSDK-589)
- Explicitly disabling both audio and video in `localStreamConstraints` now
  bypasses `getUserMedia` and instead returns a LocalMedia object without
  AudioTracks or VideoTracks; use this to create "one-way" Conversations
  (JSDK-604)

Bug Fixes
---------

- Fixed a bug where, if two Clients were listening with the same identity and
  another Client called that identity, both Clients appeared to connect to the
  Conversation even though only one should have (JSDK-588)
- Silenced an "Uncaught (in promise)" error in the browser console when an
  OutgoingInvite fails (JSDK-608)
- Fixed a bug where calling `invite` on a disconnected Conversation raised an
  an exception (JSDK-605)

0.13.4 (February 4, 2016)
=========================

Bug Fixes
---------

- Fixed a regression in `removeTrack` and related methods which caused the
  "trackRemoved" event not to be propagated to remote Participants (JSDK-512)
- Fixed a bug where `getUserMedia` would be called multiple times when accepting
  an IncomingInvite without a LocalMedia object; in Firefox, this could result
  in failing to join a Conversation; now, `getUserMedia` will be called at
  most once (JSDK-439)
- Removed a postinstall script that caused failures with NPM 3.
- Fixed a bug where a LocalTrack removed with `removeTrack` could not be added
  back with `addTrack` (JSDK-548)
- Fixed a bug where calling `stop` on a LocalTrack caused it to be removed
  (JSDK-549)

0.13.3 (January 21, 2016)
=========================

New Features
------------

- The LocalMedia `removeCamera` and `removeMicrophone` methods now accept an
  optional `stop` parameter, similar to `removeStream` and `removeTrack`.

Bug Fixes
---------

- Silenced an "Uncaught (in promise)" error in the browser console when Clients
  either rejected an IncomingInvite or canceled an OutgoingInvite (JSDK-420)
- Fixed a bug where calling `reject` on an IncomingInvite to a multi-party
  Conversation would not notify each Participant that the Client had rejected
  (JSDK-436)
- Fixed a bug where calling `removeStream` or `removeTrack` on a LocalMedia
  object would not stop the Track (JSDK-443)
- Fixed a bug where the `isEnded` property of a Track was always false, even
  after calling `stop` (JSDK-444)

0.13.2 (December 16, 2015)
==========================

Added twilio-conversations.js to NPM and Bower.

0.13.1 (December 16, 2015)
==========================

Bug Fixes
---------

- The Client identity string is now always properly URL encoded prior to
  registration with the Conversations service
- The "participantFailed" event is reliably raised in relevant failure scenarios
- Failed calls to the browser's `getUserMedia` method are now propogated
  reliably during the creation of an `OutgoingInvite` or when
  `IncomingInvite#accept` is called.

0.13.0 (December 15, 2015)
==========================

New Features
------------

- twilio-conversations.js will now auto-stop any MediaStreamTracks it gathers
  for you as part of `inviteToConversation` or `accept`-ing an IncomingInvite
  when you disconnect from a Conversation. You can bypass this behavior by
  passing in your own local MediaStream or LocalMedia object (JSDK-412)
- The "participantFailed" event emitted by the Conversation is now
  parameterized by a Participant object instead of merely the failed
  Participant's identity.
- Added the ability to remove a MediaStream from a LocalMedia object
- Added the ability to specify whether or not to stop the LocalTrack when
  removing it from a LocalMedia object (the default remains to stop the
  LocalTrack)

Bug Fixes
---------

- Fixed a bug where detaching Media or a Track could raise an uncaught error
  (JSDK-375)
- Fixed a bug which made it impossible to add or remove LocalAudioTracks and
  LocalVideoTracks and have it reflected to remote Participants (JSDK-411)
