1.2.2 (in progress)
===================

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
