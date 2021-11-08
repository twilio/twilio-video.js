Common Issues
=============

Are you experiencing an issue with twilio-video.js? Please review this list of known issues and workarounds
before opening a new issue. We recommend regularly upgrading to the latest version of the SDK, which includes new features, bug fixes and improvements (see [CHANGELOG.md](CHANGELOG.md)).


### Chrome desktop
<details>
<summary>Chrome memory leak might cause degraded experience in group rooms</summary>
<p>

   Chrome has a memory leak, which is most apparent in long running Group Rooms with 30+ Participants with most of them share media. For details, go [here](https://github.com/twilio/twilio-video.js/issues/1449).
</p>
</details>

<details>
<summary>With opus dtx enabled, sometimes background noise is heard on muted AudioTracks</summary>
<p>

   twilio-video.js enables DTX (discontinuous transmission) by default for opus. Webrtc has an issue which sometimes causes background noise to be heard on muted track when DTX is enabled, For details, see [here](https://bugs.chromium.org/p/webrtc/issues/detail?id=13051).
   To workaround this issue, you can disable the dtx with:
  ```js
  const { connect } = require('twilio-video');

  // Disable DTX for Opus.
  connect('token', {
    preferredAudioCodecs: [{ codec: 'opus', dtx: false }]
  });
  ```

</p>
</details>



### Chrome mobile
<details>
<summary>Chrome on iOS 15.1 crashes when publishing or muting a VideoTrack that is using an H264 codec</summary>
<p>

   This issue happens due to a regression on iOS 15.1 where using an H264 codec causes the browser to crash when joining a room or when muting the VideoTrack. Please use VP8 as a workaround for now. See more details [here](https://github.com/twilio/twilio-video.js/issues/1611).
</p>
</details>
<details>
<summary>Android Chrome on Pixel 3 receives corrupted video frames with codec VP8</summary>
<p>

   This is an issue in the hardware VP8 encoder on the Pixel 3 devices. See [WebRTC ticket](https://bugs.chromium.org/p/webrtc/issues/detail?id=11337). To work around this issue, please set H264 as the preferred video codec on Pixel 3. ([Example](https://github.com/twilio/video-quickstart-android/issues/470#issuecomment-623042880)).
</p>
</details>
<details>
<summary>Android Chrome 81+ Participants fail to subscribe to H264 VideoTracks in Group Rooms</summary>
<p>

   This happens primarily due to this [Chromium Bug](https://bugs.chromium.org/p/chromium/issues/detail?id=1074421).
   We have added a workaround to the SDK in version 2.4.0. For earlier versions of the SDK,
   please apply the workaround discussed in this [GitHub Issue](https://github.com/twilio/twilio-video.js/issues/966#issuecomment-619212184).
</p>
</details>

### Safari desktop
<details>
<summary>Safari 15.1 crashes when muting a VideoTrack that is using an H264 codec</summary>
<p>

   This issue happens due to a regression on Safari 15.1 where muting a VideoTrack that is using an H264 codec causes the browser to crash. Please use VP8 as a workaround for now. See more details [here](https://github.com/twilio/twilio-video.js/issues/1611).
</p>
</details>

<details>
<summary>Failures to publish tracks on Safari 15</summary>
<p>

   If your applications uses [Webrtc-adapter](https://github.com/webrtcHacks/adapter) as a dependency, please note that older versions of webrtc-adapter have a bug which leads to an error ("Client is unable to apply a remote media description - Attempted to assign to readonly property…") on Safari 15.

   To fix this issue, please update your adapter.js version to the newer one (^7.7.1) with the [fix](https://github.com/webrtcHacks/adapter/commit/de0348c756b7bda11a700bf7ea9e9393cab16421)
</p>
</details>

<details>
<summary>Echo issues in Safari when using external microphone</summary>
<p>

   This is an echo cancellation bug in Safari's implementation of WebRTC. For more details, go [here](https://bugs.webkit.org/show_bug.cgi?id=213723).
   and [here](https://github.com/twilio/twilio-video.js/issues/1433)
</p>
</details>
<details>
<summary>Angular applications missing audio and/or video tracks</summary>
<p>

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
</p>
</details>
<details>
<summary>After unpublishing a Track, Safari 12.1 Participants cannot publish Track(s) of the same kind</summary>
<p>

   Because of this Safari 12.1 [bug](https://bugs.webkit.org/show_bug.cgi?id=195489),
   once a Participant unpublishes a MediaTrack of any kind (audio or video), it will not be able to publish another MediaTrack of the same kind.        DataTracks are not affected. We have escalated this bug to the Safari Team and are keeping track of related developments.
</p>
</details>

### Safari mobile
<details>
<summary>iOS 15.1: Browser crashes when publishing or muting a VideoTrack that is using an H264 codec</summary>
<p>

   This issue happens due to a regression on iOS 15.1 where using an H264 codec causes the browser to crash when joining a room or when muting the VideoTrack. Please use VP8 as a workaround for now. See more details [here](https://github.com/twilio/twilio-video.js/issues/1611).
</p>
</details>
<details>
<summary>iOS 15: Low audio volume in Safari</summary>
<p>

   Safari on iOS version 15, sometimes routes audio to the earpiece and not the speakers by default. Which customers some time perceive as low audio volume. Find more details [here](https://github.com/twilio/twilio-video.js/issues/1586) and in this [WebKit bug](https://bugs.webkit.org/show_bug.cgi?id=230902).
</p>
</details>
<details>
<summary>iOS 15: Audio is lost in a video call after an interruption with a phone call</summary>
<p>

   Due to a regression on Safari on iOS 15, an incoming call causes local and sometimes remote media playback to stop. You can find more details in this [WebKit bug](https://bugs.webkit.org/show_bug.cgi?id=230537).
</p>
</details>
<details>
<summary>Mobile Safari Participants on iOS 13.1-13.3 sometimes fail to send audio</summary>
<p>

   This issue happened due to regression on iOS 13.1. The fix was released by Apple in iOS 13.4. Find more details in this [WebKit bug](https://bugs.webkit.org/show_bug.cgi?id=202405).
</p>
</details>
<details>
<summary>Stuttering/distorted audio in Safari on iOS 14.2 and MacOS 11.0.1</summary>
<p>

   This issue happened due to regression in Safari's WebKit in iOS version 14.2, the fix got rolled out in iOS 14.3 beta3. Find more details [here](https://github.com/twilio/twilio-video.js/issues/1296) and in this [WebKit bug](https://bugs.webkit.org/show_bug.cgi?id=218762).
</p>
</details>


### Firefox desktop
<details>
<summary>Firefox Participants sometimes fail to subscribe to DataTracks on Peer-to-Peer Rooms</summary>
<p>

   Because of this Firefox [bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1603887) Participants that join a Peer-to-Peer Room after a DataTrack      has been published by a Firefox Participant fail to subscribe to it. You can work around this issue by publishing a DataTrack while connecting to    the Room.
</p>
</details>
<details>
<summary>Firefox Participants cannot constrain their audio bandwidth</summary>
<p>

   Because of this [bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1573726), Firefox
   Participants are not able to constrain their audio bandwidth using `LocalParticipant.setParameters()`.
</p>
</details>

### All browsers

<details>
<summary>Working around the browsers' autoplay policy (which might block audio and video from playing)</summary>
<p>

   Chrome, Firefox and Safari enforce the autoplay policy, which blocks automatically
playing audio or video if the user has not interacted with your application
(ex: clicking a button to join a Room). You can find more details about the autoplay
policies here:

- [Chrome Autoplay Policy](https://developers.google.com/web/updates/2017/09/autoplay-policy-changes)
- [Firefox Autoplay Policy](https://hacks.mozilla.org/2019/02/firefox-66-to-block-automatically-playing-audible-video-and-audio/)
- [Safari Autoplay Policy](https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/)

Playback of RemoteAudioTracks should not be affected in Chrome and Firefox. Safari will
pause \<audio\> elements that play back RemoteAudioTracks if no local media is being captured.
They can be played by the application after a user interaction.

```js
remoteParticipant.on('trackSubscribed', track => {
  if (track.kind === 'audio') {
    const audioEl = track.attach();
    isUserInteractionRequired(audioEl).then(isRequired => {
      if (isRequired) {
        const playbackButton = /* Get the playback button */;
        playBackButton.onclick = () => audioEl.play();
      }
    });
  }
});

function isUserInteractionRequired(audioEl) {
  if (!audioEl.paused) {
    return Promise.resolve(false);
  }
  if (audioEl.hasAttribute('autoplay')) {
    return Promise.race([
      new Promise(resolve => audioEl.onplay = resolve),
      new Promise(resolve => setTimeout(resolve, 500))
    ]).then(() => {
      return audioEl.paused;
    });
  }
  return audioEl.play().catch(error => {
    return error.name === 'NotAllowedError';
  });
}
```

For RemoteVideoTracks, there are two ways to ensure playback:

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
</p>
</details>
<details>
<summary>Support of Beta/Canary/Nightly browser releases</summary>
<p>

   We constantly test for and ensure compatibility with the current stable and beta releases of supported browsers.
   However, because some of the APIs we rely upon, like WebRTC, are under active development in the browsers,
   we cannot guarantee compatibility with Canary or Nightly releases. Find our browsers support matrix [here](https://www.twilio.com/docs/video/javascript#supported-browsers)
</p>
</details>
<details>
<summary>Internet Explorer and other WebRTC-incompatible Browsers</summary>
<p>

   twilio-video.js requires WebRTC, which is not supported by Internet Explorer.
   While twilio-video.js will load in Internet Explorer and other browsers that do not support WebRTC,
   attempting to connect to a Room or attempting to acquire LocalTracks will fail. Find our browsers support matrix [here](https://www.twilio.com/docs/video/javascript#supported-browsers)
</p>
</details>
<details>
<summary>Aggressive Browser Extensions and Plugins</summary>
<p>

   Some browser extensions and plugins will disable WebRTC APIs, causing
twilio-video.js to fail. Examples of such plugins include

* uBlockOrigin-Extra
* WebRTC Leak Prevent
* Easy WebRTC Block

These are unsupported and likely to break twilio-video.js. If you are having
trouble with twilio-video.js, ensure these are not running.
</p>
</details>
