1.0.0-preview1
==============

twilio-conversations.js has been renamed twilio-video.js. We have also made
significant changes to the public API, namely

- OutgoingInvites and IncomingInvites have been completely removed, and
- Conversations have been replaced with Rooms, and
- A new subclass of Participant, LocalParticipant, has been added.

All other classes including Client, Participant, Media, and Tracks remain
relatively unchanged. If you are loading twilio-video.js in the browser using
a &lt;script&gt; tag, the exported global has been renamed to `Twilio.Video`.

New Features
------------

- `inviteToConversation` has been replaced with `connect`.
- You can `connect` to a Room as its sole Participant.
- You can specify the name of the Room you want to `connect` to by setting the
  `to` parameter.

Refer to the API docs for the full set of features.

Bug Fixes
---------

- A number of stability improvements have been made in the transition away from
  invites towards a Room-based model.

0.13.8
======

Bug Fixes
---------

- Fixed Track playback on Chrome 48 for Android (JSDK-661)

0.13.7
======

Bug Fixes
---------

- Fixed a bug that duplicated Track events when the same LocalTrack was removed
  and readded (JSDK-574)
- Fixed a strict mode error that affected Safari (JSDK-692)

0.13.6
======

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

0.13.5
======

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

0.13.4
======

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

0.13.3
======

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

0.13.2
======

Added twilio-conversations.js to NPM and Bower.

0.13.1
======

Bug Fixes
---------

- The Client identity string is now always properly URL encoded prior to
  registration with the Conversations service
- The "participantFailed" event is reliably raised in relevant failure scenarios
- Failed calls to the browser's `getUserMedia` method are now propogated
  reliably during the creation of an `OutgoingInvite` or when
  `IncomingInvite#accept` is called.

0.13.0
======

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
