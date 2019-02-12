Common Issues
=============

Having an issue with twilio-video.js? Unable to see remote Participants' Tracks?
Review this list of common issues to determine whether or not your issue is
known or a workaround is available. Please also take a look at the
[CHANGELOG.md](CHANGELOG.md) to see if your issue is known for a particular
release. If your issue hasn't been reported, consider submitting
[a new issue](https://github.com/twilio/twilio-video.js/issues/new).

Incompatibility between Mobile 1.x/2.x and Javascript on Firefox 63+ in Peer-to-Peer Rooms
------------------------------------------------------------------------------------------

Mozilla [announced](https://blog.mozilla.org/webrtc/how-to-avoid-data-channel-breaking/)
a change in July 2018 related to how RTCDataChannels are negotiated in Firefox 63+.
Unfortunately, this has caused an incompatibility with versions of our Android and
iOS Video SDKs that use Chromium WebRTC 57 and below.

### What is the impact?

Firefox 63+ Participants that join a Peer-to-Peer Room that also has Android and
iOS Participants with the affected versions of the Video SDK, will not be able to
publish their local media Tracks. The mobile Participants can see the Firefox 63+
Participants in the Room but no Tracks are ever published, as a result no media
is ever published/visible from those Participants.
                                                                     
### Is my app impacted?

If you use one of the following Twilio Video Android or iOS SDK versions with any
version of the Twilio Video Javascript SDK on Firefox 63+ then your application
will be impacted:

| Twilio SDK  | Affected Versions | Upgrade Path       |
| ----------- | ----------------- | ------------------ |
| Android SDK | 1.x & 2.x         | 3.0.0+             |
| iOS SDK     | 1.0.0 - 2.2.2     | 2.3.0+             |

### If my app is impacted, how can I overcome it?

Upgrade to a release of Twilio Video Android or iOS SDK as noted above. You can
find more information about any changes introduced in these releases by reviewing
the changelogs:

* [Twilio Video Android SDK 3.x](https://www.twilio.com/docs/video/changelog-twilio-video-android-3x)
* [Twilio Video iOS SDK 2.x](https://www.twilio.com/docs/video/changelog-twilio-video-ios-version-2x)

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
