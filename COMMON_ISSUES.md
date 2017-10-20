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

Safari
------

twilio-video.js 1.2.1 introduces experimental support for Safari 11 and newer.
Support for Safari is "experimental" because, at the time of writing, Safari
does not support VP8. This means you may experience codec issues in Group Rooms.
You may also experience codec issues in Peer-to-Peer (P2P) Rooms containing
Android- or iOS-based Participants who do not support H.264. However, P2P Rooms
with browser-based Participants should work.

### Angular

There is a misinteraction between one of Angular's libraries, Zone.js, and
Safari's RTCPeerConnection APIs. For more information, see [here](https://github.com/angular/zone.js/issues/883)
for the issue filed against Zone.js and [here](https://bugs.webkit.org/show_bug.cgi?id=175802)
for the issue filed against WebKit. In order to work around this issue, you
should include Zone.js's webapis-rtc-peer-connection.js in your app, after
loading Zone.js. For example,

```html
<script src="node_modules/zone.js/dist/zone.js"></script>
<script src="node_modules/zone.js/dist/webapis-rtc-peer-connection.js"></script>
```

Microsoft Edge
--------------

Although Microsoft Edge includes some WebRTC support, it also includes some
limitations that make it difficult to support today. We plan on adding Edge
support to twilio-video.js, but we may do so by leveraging Edge's ORTC APIs
instead.

Internet Explorer and WebRTC-incompatible Browsers
--------------------------------------------------

twilio-video.js requires WebRTC, which is not supported by Internet Explorer.
While twilio-video.js will load in Internet Explorer and other browsers that
do not support WebRTC, attempting to connect to a Room or attempting to acquire
LocalTracks will fail.

Firefox
-------

### VideoTrack shows black frames or RemoteDataTrack doesn't receive messages

This issue can occur when connecting to a Peer-to-peer or Group Room with a
Firefox-based Participant who is not sharing audio. WebRTC implementations like
Chrome, Safari, and Twilio's media server expect to bundle on the first media
section in an SDP, which is typically an audio media section; however, Firefox,
when it sees that audio is not being sent or received, rejects its audio media
section and attempts to bundle on a subsequent media section. The result is a
broken ICE transport and the inability to send or receive video or data. There's
a Chrome issue (see [here](https://bugs.chromium.org/p/webrtc/issues/detail?id=6280))
describing this scenario, as well as a [Firefox bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1300863)
tracking the work to stop rejecting the audio media section. There has also been
[some discussion on the public-webrtc@w3.org mailing list](https://lists.w3.org/Archives/Public/public-webrtc/2017Aug/0076.html)
discussing just what a WebRTC implementation should do.

In the meantime, the suggested workaround is to always share audio from
Firefox-based Participants when connecting to a Peer-to-peer Room. If you do not
intend to playback the audio, you can `disable` the Track before connecting.
For example, using the microphone:

```js
const audioTrack = await Twilio.Video.createLocalAudioTrack();
audioTrack.disable();
```

If you do not want to request microphone access, you can go further and create a
"dummy" Track using the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API):

```js
const audioContext = typeof AudioContext !== 'undefined'
  ? new AudioContext()
  : new webkitAudioContext()
const node = audioContext.createMediaStreamDestination()
const stream = node.stream
const dummyTrack = stream.getAudioTracks()[0]
const audioTrack = new Twilio.Video.LocalAudioTrack(dummyTrack);
```

Then, pass the `audioTrack` to `connect`:

```js
const room = await Twilio.Video.connect(token, { tracks: [audioTrack] });
```

### RemoteDataTrack Properties (`maxPacketLifeTime` and `maxRetransmits`)

Firefox has not yet implemented getter's for RTCDataChannel's
`maxPacketLifeTime` and `maxRetransmits` properties. As such, we cannot raise
accurate values for the `maxPacketLifeTime` and `maxRetransmits` properties on
RemoteDataTrack. (Setting these values still works, though!) See below for
issues on the Firefox bug tracker:

* [Bug 881532](https://bugzilla.mozilla.org/show_bug.cgi?id=881532)
* [Bug 1278384](https://bugzilla.mozilla.org/show_bug.cgi?id=1278384)

Aggressive Browser Extensions and Plugins
-----------------------------------------

Some browser extensions and plugins will disable WebRTC APIs, causing
twilio-video.js to fail. Examples of such plugins include

* uBlockOrigin-Extra
* WebRTC Leak Prevent
* Easy WebRTC Block

These are unsupported and likely to break twilio-video.js. If you are having
trouble with twilio-video.js, ensure these are not running.
