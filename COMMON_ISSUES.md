Common Issues
=============

Having an issue with twilio-video.js? Unable to see remote Participants' Tracks?
Review this list of common issues to determine whether or not your issue is
known or a workaround is available. Please also take a look at the
[CHANGELOG.md](CHANGELOG.md) to see if your issue is known for a particular
release. If your issue hasn't been reported, consider submitting
[a new issue](https://github.com/twilio/twilio-video.js/issues/new).

Working around the browsers' autoplay policy
--------------------------------------------

Chrome, Firefox and Safari enforce the autoplay policy, which blocks automatically
playing audio or video if the user has not interacted with your application
(ex: clicking a button to join a Room). You can find more details about the autoplay
policies here:

- [Chrome Autoplay Policy](https://developers.google.com/web/updates/2017/09/autoplay-policy-changes)
- [Firefox Autoplay Policy](https://hacks.mozilla.org/2019/02/firefox-66-to-block-automatically-playing-audible-video-and-audio/)
- [Safari Autoplay Policy](https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/)

Playback of RemoteAudioTracks should not be affected since its playback does not
depend on the \<audio\> element. However, for RemoteVideoTracks, there are two ways
to ensure playback:

- Make sure that the user interacts with your application before joining a Room.
  Here is an example:
  
  ```js
  document.getElementById('join_room').addEventListener('click', () => {
    Twilio.Video.connect(token, {
      name: 'my-room'
    });
  });
  ```

- If your application needs to join a Room on page load, set the `muted` attribute
  of the \<video\> element returned by `VideoTrack.attach()` to true. The autoplay
  policy allows muted video to be automatically played.
  
  ```js
  const video = videoTrack.attach();
  video.muted = true;
  ```

Chrome 76+ Group Room Participants downgrade outgoing video bitrate for high `maxAudioBitrate` values
-----------------------------------------------------------------------------------------------------

Because of this [bug](https://bugs.chromium.org/p/chromium/issues/detail?id=1002875), if you
set the maximum outgoing audio bitrate (`maxAudioBitrate`) to values greater than or equal to
64000 bps in a Group Room, then the outgoing video bitrate gets stuck at a very low value
resulting in degraded quality for Participants subscribing to your VideoTrack.

Chrome 76+ DataTrack incompatibility with 2.X Mobile SDKs in Peer-to-Peer Rooms
-------------------------------------------------------------------------------

Chrome 76 [added support](https://groups.google.com/forum/#!msg/discuss-webrtc/Y7TIuNbgP8M/UoXP-RuxAwAJ) for a
[new SDP format](https://bugs.chromium.org/p/webrtc/issues/detail?id=4612) for RTCDataChannel negotiation. This
new SDP format is not compatible with 2.x Android and iOS Video SDKs when used with Peer-to-Peer Rooms. In a
Peer-to-Peer room, Chrome 76+ Participants and affected mobile SDKs might not be able to subscribe to each other’s
DataTracks. Please refer to the upgrade paths listed in [this issue](https://github.com/twilio/twilio-video-ios/issues/52)
to address this.

Firefox Participants cannot constrain their audio bandwidth
-----------------------------------------------------------

Because of this [bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1573726), Firefox
Participants are not able to constrain their audio bandwidth using `LocalParticipant.setParameters()`.

Firefox 64/65 Participants may sometimes experience media loss in Group Rooms
-----------------------------------------------------------------------------

Mozilla introduced a [regression](https://bugzilla.mozilla.org/show_bug.cgi?id=1526477)
in Firefox 64, because of which Firefox 64/65 Participants in a Group Room may
sometimes experience media loss. For more details, please refer to this [issue](https://github.com/twilio/twilio-video.js/issues/565).

Firefox 63+ Incompatible with Mobile SDKs 1.x/2.x in Peer-to-Peer Rooms
-----------------------------------------------------------------------

Firefox 63 [introduced](https://blog.mozilla.org/webrtc/how-to-avoid-data-channel-breaking/)
a new SDP format for data channel negotiation. This new SDP format has caused
incompatibility with the 1.x and 2.x Android and iOS Video SDKs when used with
Peer-to-Peer Rooms. Please refer to this [issue](https://github.com/twilio/twilio-video.js/issues/544)
to find out if your app is impacted and how to overcome it.

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
