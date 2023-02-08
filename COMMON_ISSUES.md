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
<summary>Android 11: Participants are unable to connect to a room due to ICE gathering failures on certain devices</summary>
<p>

   Participants are unable to connect to a room on certain Android 11 devices due to a [Chromium bug](https://bugs.chromium.org/p/chromium/issues/detail?id=1240237) where the browser is unable to gather ice candidates. Please see this [github issue](https://github.com/twilio/twilio-video.js/issues/1701#issuecomment-1067533348) for more details and a potential solution to mitigate the issue.
</p>
</details>

### Safari desktop
<details>
<summary>Browser crashes when muting a VideoTrack that is using an H264 codec on Safari 15.1</summary>
<p>

   Due to a regression on Safari 15.1, the browser crashes when a VideoTrack is muted that is using an H264 codec. Please use VP8 as a workaround for now. See more details [here](https://github.com/twilio/twilio-video.js/issues/1611).
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
<summary>Video elements may not be visible when applying a 3d transform</summary>
<p>

   In some cases, a video element may not be visible when using a 3d CSS transform (such as `rotateY(180deg)`) to mirror a local video track. It is recommended that a 2d transform be used instead.

   Recommended 2d transform to mirror a video track:
```css
transform: scaleX(-1)
```

   This issue is also present in Safari mobile.

   For more information, please see the discussion in [this issue](https://github.com/twilio/twilio-video.js/issues/1724).
</p>
</details>

### Safari mobile
<details>
<summary>iOS 15: Echo issues on iOS 15 devices after attaching video tracks</summary>
<p>

   Attaching a VideoTrack to a video element causes echo issues if you have a LocalAudioTrack that is already attached to an audio element. This happens due to an iOS 15 [bug](https://bugs.webkit.org/show_bug.cgi?id=241492) where the audio element is unintentionally unmuted.

   Apple has already fixed this issue on iOS 15.5. However, older versions will continue to experience the issue. As a workaround, you can skip attaching the LocalAudioTrack to an audio element to prevent a feedback loop that causes the echo issue. If you really need to attach the LocalAudioTrack for any reason, please feel free to reach out to us in this repo and we will help to find a workaround depending on your use case.
</p>
</details>
<details>
<summary>iOS 15: VideoTracks goes black and the page freezes on certain interruptions</summary>
<p>

   Certain interruptions such as incoming calls, backgrounding the browser or switching between apps causes VideoTracks on Chrome and Safari on iOS 15.1 to go black. Sometimes, the whole page also freezes and become unresponsive causing audio and video to cut off. These issues are regressions on iOS 15.1. See the following bugs for more details.

   * [Page freezing](https://bugs.webkit.org/show_bug.cgi?id=230922#c12)
   * [VideoTrack going black](https://bugs.webkit.org/show_bug.cgi?id=232599)

   A workaround can be implemented to prevent the VideoTrack from going black. This workaround however doesn't prevent the issue where sometimes the page freezes. It is recommended to apply this workaround on Chrome and Safari on iOS 15.1.

  ```js
  // Keeps track of video elements and their event listeners
  const videoElements = {};

  // Listen to onPlay and onPause events and intelligently re-attach the video element
  function shimVideoElement(track, el) {
    let wasInterrupted = false;

    const onPause = () => {
      wasInterrupted = true;
    };

    const onPlay = () => {
      if (wasInterrupted) {
        track.detach(el);
        track.attach(el);
        wasInterrupted = false;
      }
    };

    el.addEventListener('pause', onPause);
    el.addEventListener('play', onPlay);

    // Track this element so we can remove the listeners
    videoElements[el] = { onPause, onPlay };
  }
  ```

  Apply the workaround after attaching the video element.

  ```js
  videoTrack.attach(videoElement);
  shimVideoElement(videoTrack, videoElement);
  ```

  Remove the listeners before detaching the video element.

  ```js
  const { onPause, onPlay } = videoElements[videoElement];
  videoElement.removeEventListener('pause', onPause);
  videoElement.removeEventListener('play', onPlay);
  ```
</p>
</details>
<details>
<summary>iOS 15: Browser crashes when publishing or muting a VideoTrack that is using an H264 codec</summary>
<p>

   Chrome and Safari on iOS 15.1 crashes when a VideoTrack is muted or published using an H264 codec. This issue happens due to a regression on iOS 15.1. Please use VP8 as a workaround for now. See more details [here](https://github.com/twilio/twilio-video.js/issues/1611).
</p>
</details>
<details>
<summary>iOS 15: Low audio volume in Safari</summary>
<p>

   Safari on iOS version 15, sometimes routes audio to the earpiece and not the speakers by default. Which customers some time perceive as low audio volume. Find more details [here](https://github.com/twilio/twilio-video.js/issues/1586) and in this [WebKit bug](https://bugs.webkit.org/show_bug.cgi?id=230902). As a workaround, you can pipe all remote audio tracks into a single audio context for iOS 15. Using a gain node, you can increase the gain value to increase the audio volume levels. See example below.

   ```js
   // Make sure to reuse the audioContext object as browsers
   // have limits to the number of AudioContext instances you can create.
   const audioContext = new (window.AudioContext || window.webkitAudioContext)();

   function attachAudioTrack(remoteAudioTrack) {
     const audioNode = audioContext.createMediaStreamSource(new MediaStream([remoteAudioTrack.mediaStreamTrack]));
     const gainNode = audioContext.createGain();

     // Adjust this value depending on your customers' preference
     gainNode.gain.value = 20;

     audioNode.connect(gainNode);
     gainNode.connect(audioContext.destination);
   }

   // Attach the RemoteAudioTrack once received.
   attachAudioTrack(remoteAudioTrack);
   ```

   This workaround has the following potential side effects.

   * There is a possibility of the introduction of echo. Please adjust the gain value and check for echo while testing the workaround.
   * The output volume might end up really high if the user switches headsets.
   * The default volume might end up really high once Apple rolls out the fix for this issue.

   Keeping the side effects in mind, you might need to adjust your UI to improve the experience. For example, you can turn off this workaround by default and have a "call to action" in your UI that allows the user to turn the volume up if they cannot hear any audio. This button will then apply the workaround. Another option is to listen for `devicechange` events to determine if the user switches headsets. When this happens, you will have the ability to reset the gain value.

</p>
</details>
<details>
<summary>iOS 16: Local Media Tracks are lost in a video call after an interruption with a phone call</summary>
<p>

   Due to a bug on Safari on iOS 16, an incoming call causes local and sometimes remote media playback to stop after the **second** incoming call. You can find more details in this [WebKit bug](https://bugs.webkit.org/show_bug.cgi?id=240651). As a workaround, you can call the [Room.refreshInactiveMedia](https://sdk.twilio.com/js/video/releases/2.26.0/docs/Room.html#refreshInactiveMedia__anchor) method in your application in order to restart the muted local media tracks and resume playback of the paused remote media tracks.
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
<details>
<summary>Participant is disconnected from the Room after being backgrounded for 30 seconds due to another audio/video app or incoming phone call</summary>
<p>

   This is due to iOS suspending browser sessions that are not capturing audio after 30 seconds, as mentioned in this [Webkit bug comment](https://bugs.webkit.org/show_bug.cgi?id=204681#c5). You can work around this by rejoining the Room once the browser is foregrounded.
</p>
</details>

### Firefox desktop
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
<details>
<summary>setSinkId method is not implemented in all browsers</summary>
<p>

   The `audioElement.setSinkId()` method, which is used to change the audio output device for a given HTML audio element, is only implemented in Desktop Chrome and Desktop Edge. Therefore, it is not possible for users to change their audio output device in other browsers. Users will have to use their operating system settings to change their audio output device instead.

   More information about this method (including browser compatibility) is available [here](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/setSinkId).
</p>
</details>