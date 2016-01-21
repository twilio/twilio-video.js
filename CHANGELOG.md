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
