Common Issues
=============

Having an issue with twilio-video.js? Unable to see remote Participants' Tracks?
Review this list of common issues to determine whether or not your issue is
known or a workaround is available. Please also take a look at the
[CHANGELOG.md](CHANGELOG.md) to see if your issue is known for a particular
release. If your issue hasn't been reported, consider submitting
[a new issue](https://github.com/twilio/twilio-video.js/issues/new).

Chrome and Firefox Beta, Canary, Nightly, etc., Releases
--------------------------------------------------------

We always ensure compatibility with the current Chrome and Firefox stable
releases; however, because some of the APIs we rely upon, like WebRTC, are under
active development in the browsers, we cannot guarantee compatibility with
Canary or Nightly releases. We will, however, stay abreast of changes in browser
beta releases so that we can adopt changes in advance of each browser's next
stable release.

Safari, Internet Explorer, and WebRTC-incompatible Browsers
-----------------------------------------------------------

twilio-video.js requires WebRTC, and neither Safari nor Internet Explorer
support WebRTC. While twilio-video.js will load in these browsers, actually
connecting to a Room or acquiring LocalTracks will fail.

adapter.js
----------

The [webrtc/adapter](https://github.com/webrtc/adapter) project provides "a
shim to insulate apps from spec changes and prefix differences" with respect to
browsers' WebRTC APIs and implementations. Developers often use this library
when writing WebRTC applications so that they don't have to manually handle the
quirks and divergences between each browser.

twilio-video.js bundles a similar set of adapters internally, including support
for some features not implemented by adapter.js, such as rollback.  However,
twilio-video.js and adapter.js differ in their approaches: twilio-video.js
_wraps_ browser APIs, like RTCPeerConnection, and uses these wrapped versions
internally; adapter.js _mutates_ browser APIs. This mutation causes
twilio-video.js's wrapped adapters to break.

We plan to evaluate changes we can make to twilio-video.js in order to
work alongside adapter.js, but until then adapter.js is unsupported.

VideoTrack shared by Firefox appears black
------------------------------------------

This issue can occur when connecting to a peer-to-peer Room with a Firefox-based
Participant who is not sharing audio. (If all the other Participants are
Firefox-based, this issue will not occur.) The issue arises due to a difference
in bundle behavior between Google and Mozilla's WebRTC implementations. For
more information, see [Issue 6280](https://bugs.chromium.org/p/webrtc/issues/detail?id=6280)
on the WebRTC bug tracker.

The suggested workaround is to always share audio from Firefox-based
Participants when connecting to a peer-to-peer Room. If you do not intend to
playback the audio, you can `disable` the Track before connecting. For example,

```js
const audioTrack = await Twilio.Video.createLocalAudioTrack();

audioTrack.disable();

const room = await Twilio.Video.connect(token, { tracks: [audioTrack] });
```

Aggressive Browser Extensions and Plugins
-----------------------------------------

Some browser extensions and plugins will disable WebRTC APIs, causing
twilio-video.js to fail. Examples of such plugins include

* uBlockOrigin-Extra
* WebRTC Leak Prevent
* Easy WebRTC Block

These are unsupported and likely to break twilio-video.js. If you are having
trouble with twilio-video.js, ensure these are not running.
