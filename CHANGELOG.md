The Twilio Programmable Video SDKs use [Semantic Versioning](http://www.semver.org/). Twilio supports version N-1 for 12 months after the first GA release of version N. We recommend you upgrade to the latest version as soon as possible to avoid any breaking changes. Version 2.x is the lastest Video JavaScript SDK.

**Version 1.x reached End of Life on September 8th, 2021.** See the changelog entry [here](https://www.twilio.com/changelog/end-of-life-complete-for-unsupported-versions-of-the-programmable-video-sdk). Support for the 1.x version ended on December 4th, 2020.

2.28.1 (October 3, 2023)
========================

Bug Fixes
---------

- Previously, a Chrome iOS 17 Participant's local audio (Krisp noise cancellation enabled) did not recover after foregrounding the browser following the playing of a YouTube video (or some other application which requires microphone permissions). We work around this by permanently disabling the Krisp noise cancellation upon foregrounding the browser. (VIDEO-13006)

2.28.0 (September 14, 2023)
===========================

Bug Fixes
---------

- Fixed a bug where a Chrome iOS 17 Participant's local and remote media (Krisp Noise Cancellation enabled) failed to recover after interacting with a PSTN call in full-screen mode. (VIDEO-13011)
- Fixed a bug where a Chrome iOS 17 Participant's audio with Krisp Noise Cancellation did not recover after interacting with a system popup. (VIDEO-13012)
- Fixed a bug where a Chrome iOS 17 Participant's audio with Krisp Noise Cancellation did not recover after invoking Siri. (VIDEO-13013)

2.27.0 (March 21, 2023)
=======================

Changes
-------

`VideoTrack.addProcessor` now works on browsers that support `OffscreenCanvas` as well as `HTMLCanvasElement`. When used with
[@twilio/video-processors v2.0.0](https://github.com/twilio/twilio-video-processors.js/blob/2.0.0/CHANGELOG.md), the Virtual
Background feature will work on browsers that supports [WebGL2](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext).
See [VideoTrack.addProcessor](https://sdk.twilio.com/js/video/releases/2.27.0/docs/VideoTrack.html#addProcessor__anchor) and
[@twilio/video-processors v2.0.0](https://github.com/twilio/twilio-video-processors.js/blob/2.0.0/CHANGELOG.md) for details.

### Example

```ts
import { createLocalVideoTrack } from 'twilio-video';
import { Pipeline, VirtualBackgroundProcessor } from '@twilio/video-processors';

const virtualBackgroundProcessor = new VirtualBackgroundProcessor({
  pipeline: Pipeline.WebGL2,
  // ...otherOptions
});

await virtualBackgroundProcessor.loadModel();

const videoTrack = await createLocalVideoTrack({
  width: 640,
  height: 480,
  frameRate: 24
});

videoTrack.addProcessor(processor, {
  inputFrameBufferType: 'video',
  outputFrameBufferContextType: 'webgl2',
});
```

2.26.2 (February 21, 2023)
==========================

Changes
-------

- Starting from version 110, Chrome will no longer support the iSAC audio codec. The SDK will now log a warning to the console
  whenever an audio or a video codec that is specified in `ConnectOptions.preferredAudioCodecs` and `ConnectOptions.preferredVideoCodecs`
  is not supported by the browser. (VIDEO-12494)

Bug Fixes
---------

- Fixed a bug on Chrome versions 112+ where `Room.getStats()` did not reject the returned Promise when an exception was
  raised while accessing WebRTC stats that due to a TypeError caused by trying to read from the now-removed `RTCMediaStreamTrackStats`. (VIDEO-12534)

2.26.1 (January 31, 2023)
=========================

Bug Fixes
---------

- Fixed a bug that manifests on Chrome versions 112+ where `Room.getStats()` raises an unhandled exception due to a
  TypeError caused by trying to read from the now-removed `RTCMediaStreamTrackStats`. Instead, the SDK now reads from
  the `RTCMediaSourceStats`. (VIDEO-12411) 
- Fixed an error in the type definition for the `attach()` method of `AudioTrack` and `VideoTrack`. (VIDEO-12242)
- Fixed an error in the type definition for `createLocalAudioTrack()`. (VIDEO-12383)

2.26.0 (December 14, 2022)
==========================

New Features
------------

- The [`LocalAudioTrack`](https://sdk.twilio.com/js/video/releases/2.26.0/docs/LocalAudioTrack.html) and
  [`LocalVideoTrack`](https://sdk.twilio.com/js/video/releases/2.26.0/docs/LocalVideoTrack.html) classes now provide a
  new boolean property called `isMuted`, which lets you know if the audio or video source is currently providing raw media
  samples. The classes also emit `muted` and `unmuted` events if the value of `isMuted` toggles. The application can use
  these APIs to detect temporary loss of microphone or camera to other applications (ex: an incoming phone call on an iOS device),
  and update the user interface accordingly. (VIDEO-11360)

- The `Room` class provides a new method called [refreshInactiveMedia](https://sdk.twilio.com/js/video/releases/2.26.0/docs/Room.html#refreshInactiveMedia),
  which restarts any muted local media Tracks, and plays any inadvertently paused HTMLMediaElements that are attached to
  local and remote media Tracks. This is useful especially on iOS devices, where sometimes your application's media may
  not recover after an incoming phone call. You can use this method in conjunction with the local media Track's `isMuted`
  property described previously to recover local and remote media after an incoming phone call as shown below. (VIDEO-11360)

  ### Vanilla JS

  #### html

  ```html
  <button id="refresh-inactive-media" disabled>Refresh Inactive Media</button>
  ```

  #### js

  ```js
  const { connect } = require('twilio-video');

  const room = await connect('token', { name: 'my-cool-room' });

  const $refreshInactiveMedia = document.getElementById('refresh-inactive-media');
  $refreshInactiveMedia.onclick = () => room.refreshInactiveMedia();

  const [{ track: localAudioTrack }] = [...room.localParticipant.audioTracks.values()];
  const [{ track: localVideoTrack }] = [...room.localParticipant.videoTracks.values()];

  const isLocalAudioOrVideoMuted = () => {
    return localAudioTrack.isMuted || localVideoTrack.isMuted;
  }

  const onLocalMediaMutedChanged = () => {
    $refreshInactiveMedia.disabled = !isLocalAudioOrVideoMuted();
  };

  [localAudioTrack, localVideoTrack].forEach(localMediaTrack => {
    ['muted', 'unmuted'].forEach(event => {
      localMediaTrack.on(event, onLocalMediaMutedChanged);
    });
  });
  ```

  ### React

  #### src/hooks/useLocalMediaMuted.js

  ```js
  import { useEffect, useState } from 'react';

  export default function useLocalMediaMuted(localMediaTrack) {
    const [isMuted, setIsMuted] = useState(localMediaTrack?.isMuted ?? false);

    useEffect(() => {
      const updateMuted = () => setIsMuted(localMediaTrack?.isMuted ?? false);
      updateMuted();

      localMediaTrack?.on('muted', updateMuted);
      localMediaTrack?.on('unmuted', updateMuted);

      return () => {
        localMediaTrack?.off('muted', updateMuted);
        localMediaTrack?.off('unmuted', updateMuted);
      };
    }, [localMediaTrack]);

    return isMuted;
  }
  ```

  #### src/components/room.js

  ```jsx
  import useLocalMediaMuted from '../hooks/useLocalMediaMuted';

  export default function Room({ room }) {
    const [{ track: localAudioTrack }] = [...room.localParticipant.audioTracks.values()];
    const [{ track: localVideoTrack }] = [...room.localParticipant.videoTracks.values()];

    const isLocalAudioMuted = useLocalMediaMuted(localAudioTrack);
    const isLocalVideoMuted = useLocalMediaMuted(localVideoTrack);
    const isLocalMediaMuted = isLocalAudioMuted || isLocalVideoMuted;

    const refreshInactiveMedia = () => {
      room.refreshInactiveMedia();
    };

    return (
      <>
        ...
        {isLocalMediaMuted && <Button onClick={refreshInactiveMedia}>
          Refresh Inactive Media
        </Button>}
        ...
      </>
    );
  }
  ```

2.25.0 (November 14, 2022)
==========================

New Features
------------

### Auto-switch default audio input devices

This release adds a new feature that preserves audio continuity in situations where end-users change the default audio input device.
A LocalAudioTrack is said to be capturing audio from the default audio input device if:

- it was created using the MediaTrackConstraints `{ audio: true }`, or
- it was created using the MediaTrackConstraints `{ audio: { deviceId: 'foo' } }`, and "foo" is not available, or
- it was created using the MediaTrackConstraints `{ audio: { deviceId: { ideal: 'foo' } } }` and "foo" is not available

In previous versions of the SDK, if the default device changed (ex: a bluetooth headset is connected to a mac or windows laptop),
the LocalAudioTrack continued to capture audio from the old default device (ex: the laptop microphone). Now, a LocalAudioTrack
will switch automatically from the old default audio input device to the new default audio input device (ex: from the laptop microphone to the headset microphone).
This feature is controlled by a new [CreateLocalAudioTrackOptions](https://sdk.twilio.com/js/video/releases/2.25.0/docs/global.html#CreateLocalAudioTrackOptions)
property `defaultDeviceCaptureMode`, which defaults to `auto` (new behavior) or can be set to `manual` (old behavior).

The application can decide to capture audio from a specific audio input device by creating a LocalAudioTrack:

- using the MediaTrackConstraints `{ audio: { deviceId: 'foo' } }`, and "foo" is available, or
- using the MediaTrackConstraints `{ audio: { deviceId: { ideal: 'foo' } } }` and "foo" is available, or
- using the MediaTrackConstraints `{ audio: { deviceId: { exact: 'foo' } } }` and "foo" is available

In this case, the LocalAudioTrack DOES NOT switch to another audio input device if the current audio input device is no
longer available. See below for the behavior of this property based on how the LocalAudioTrack is created. (VIDEO-11701)

```js
const { connect, createLocalAudioTrack, createLocalTracks } = require('twilio-video');

// Auto-switch default audio input devices: option 1
const audioTrack = await createLocalAudioTrack();

// Auto-switch default audio input devices: option 2
const audioTrack1 = await createLocalAudioTrack({ defaultDeviceCaptureMode: 'auto' });

// Auto-switch default audio input devices: option 3
const [audioTrack3] = await createLocalTracks({ audio: true });

// Auto-switch default audio input devices: option 4
const [audioTrack4] = await createLocalTracks({ audio: { defaultDeviceCaptureMode: 'auto' } });

// Auto-switch default audio input devices: option 5
const room1 = await connect({ audio: true });

// Auto-switch default audio input devices: option 6
const room2 = await connect({ audio: { defaultDeviceCaptureMode: 'auto' } });

// Disable auto-switch default audio input devices
const room = await createLocalAudioTrack({ defaultDeviceCaptureMode: 'manual' });
```

**Limitations**

- This feature is not enabled on iOS as it is natively supported.
- Due to this [WebKit bug](https://bugs.webkit.org/show_bug.cgi?id=232835), MacOS Safari Participants may lose their local audio after switching between default audio input devices two-three times.
- This feature is not supported on Android Chrome, as it does not support the [MediaDevices.ondevicechange](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/devicechange_event#browser_compatibility) event.

2.24.3 (October 10, 2022)
=========================

Bug Fixes
---------

- Fixed a bug where iOS Safari Participant could not hear or see others after switching back from YouTube picture-in-picture mode. (VIDEO-11352)
- Fixed a bug where iOS Safari Participant could not hear others after switching from recording an audio message in a messenger app. (VIDEO-11354)
- Fixed a bug where iOS Safari Participant could not hear or see others after watching a video in another browser tab. (VIDEO-11356)
- Fixed a bug where iOS Safari Participant sometimes could not hear or see others after finishing an incoming call in full screen mode. (VIDEO-11359)

2.24.2 (September 29, 2022)
===========================

Bug Fixes
---------

- Fixed a bug where sometimes, a `MediaClientRemoteDescFailedError` was raised when a Chrome Participant who had enabled
  Adaptive Simulcast (`ConnectOptions.preferredVideoCodecs = 'auto'`) tried to publish a camera Track after publishing a
  `<canvas>` Track. (VIDEO-11516)
- Fixed an issue where the Krisp Noise Cancellation fails to load in an application where the content security policy
  directives `default-src self unsafe-eval` are used. (VIDEO-11537)

2.24.1 (September 6, 2022)
==========================

Bug Fixes
---------

- Fixed a bug where sometimes a runtime error was raised on iOS devices as shown below. (VIDEO-11263)
  ```
  Unhandled Runtime Error: TypeError: null is not an object (evaluating 'el.paused')
  ```
- The LocalTrackOptions type definition now contains `logLevel` as an optional property. (VIDEO-10659)
- Fixed an issue where the `import` keyword was causing problems in webpack and typescript projects. (VIDEO-11220)

2.24.0 (August 22, 2022)
========================

New Features
------------

- The support for twilio approved 3rd party noise cancellation solutions is now **generally available**.

Bug Fixes
---------

- Fixed an issue where input media track was not stopped, after `localAudioTrack.stop()` when using noiseCancellation (VIDEO-11047)
- Added versioning support for noise cancellation plugin. This SDK will require noise cancellation plugin to be version 1.0.0 or greater. (VIDEO-11087)

2.23.0 (July 28, 2022)
======================

New Features
------------

- This release adds private beta support for 3rd party noise cancellation solution. You need to host twilio approved 3rd party plugin on your web server to enable noise cancellation. Please fill out [this form](https://forms.gle/eeFyoGJj1mgMrxN88) to request access to the 3rd party plugin.

Once you get the access to the plugin, You can install it from npm with:
```
npm install <noise_cancellation_plugin>
```

Once installed, you need to host the contents of `./node_modules/<noise_cancellation_plugin>/dist/` from your web server. We recommend that you add plugin version number to the hosted path to ensure that browser does not use [stale version](https://www.keycdn.com/support/what-is-cache-busting) when its updated. You need to pass the path to the hosted files to `twilio-video` sdk when creating audio track as shown in the example below. The example below assumes that you have hosted the files at `/noise_cancellation_plugin/1.0.0/dist` on your web server.

```ts
const { connect, createLocalAudioTrack } = require('twilio-video');

// create a local audio track and have it use
// @twilio/krisp-audio-plugin for noise cancellation processing.
const localAudioTrack = await Video.createLocalAudioTrack({
  noiseCancellationOptions: {
    vendor: 'krisp',
    sdkAssetsPath: '/noise_cancellation_plugin/1.0.0/dist'
  }
});

// publish the track to a room
const room = await connect( token, {
  tracks: [localAudioTrack]
  // ... any other connect options
});

// you can enable/disable noise cancellation at runtime
// using noiseCancellation interface exposed by localAudioTrack
function updateNoiseCancellation(enable: boolean) {
  const noiseCancellation = localAudioTrack.noiseCancellation;

  if (noiseCancellation) {
    enable ? noiseCancellation.enable() : noiseCancellation.disable();
  }
}

```

**NOTE:** If your application is using the `default-src self` content security policy directive, then you should add
another directive `unsafe-eval`, which is required for the Krisp Audio Plugin to load successfully.

2.22.2 (July 25, 2022)
======================

Changes
-------

- `isSupported` flag now returns `false` if the browser does not support the Unified Plan SDP format. (VIDEO-10307)

  The following is a list of browsers with Unified Plan as the default SDP format.
  - Chrome 72+
  - Safari 12.1+
  - Firefox 38+

2.22.1 (July 11, 2022)
======================

Bug Fixes
---------

- The encoding of audio and screen share Tracks are prioritized in Chrome and Safari, thereby more gracefully degrading
  their quality in limited network conditions. (VIDEO-10212)

2.22.0 (July 5, 2022)
====================

New Features
------------

This release include the **Media Warnings API (Beta)** to help surface media related warning events on the SDK whenever the media server is not able to detect media from a published audio or video track.

### Example

```js
const room = await connect('token', {
  notifyWarnings: [ 'recording-media-lost' ]
  // Other connect options
});

Array.from(room.localParticipant.tracks.values()).forEach(publication => {
  publication.on('warning', name => {
    if (name === 'recording-media-lost') {
      console.log(`LocalTrack ${publication.track.name} is not recording media.`);

      // Wait a reasonable amount of time to clear the warning.
      const timer = setTimeout(() => {
        // If the warning is not cleared, you can manually
        // reconnect to the room, or show a dialog to the user
      }, 5000);

      publication.once('warningsCleared', () => {
        console.log(`LocalTrack ${publication.track.name} warnings have cleared!`);
        clearTimeout(timer);
      });
    }
  });
});
```

### API Definitions

#### ConnectOptions

- **notifyWarnings** - An array of warnings to listen to. By default, this array is empty and no warning events will be raised. Possible warning values include:

  - `recording-media-lost` - Raised when the media server has not detected any media on the published track that is being recorded in the past 30 seconds. This usually happens when there are network interruptions or when the track has stopped.

#### Events

The SDK raises warning events when it detects certain conditions. You can implement callbacks on these events to act on them, or to alert the user of an issue. Subsequently, "warningsCleared" event is raised when conditions have returned to normal.

- **LocalTrackPublication.on('warning', callback(name))** - Raised when the published Track encounters a warning.

- **LocalTrackPublication.on('warningsCleared', callback())** - Raised when the published Track cleared all warning.

- **LocalParticipant.on('trackWarning', callback(name, publication))** - Raised when one of the LocalParticipant's published tracks encounters a warning.

- **LocalParticipant.on('trackWarningsCleared', callback(publication))** - Raised when one of the LocalParticipant's published tracks cleared all warning.

- **Room.on('trackWarning', callback(name, publication, participant))** - Raised when one of the LocalParticipant's published tracks in the Room encounters a warning.

- **Room.on('trackWarningsCleared', callback(publication, participant))** - Raised when one of the LocalParticipant's published tracks in the Room cleared all warning.

2.21.3 (June 7, 2022)
====================

Bug Fixes
---------

- Fixed an issue where the generated API documentation has a missing search bar. (VIDEO-10199)

2.21.2 (June 1, 2022)
=====================

Bug Fixes
---------

- Fixed an issue where publishing a video track sometimes caused a failure with "Unhandled exception: Client is unable to create or apply a local media description". (VIDEO-9511)
- Fixed an issue where the `dimensionsChanged` event was not firing when the track dimensions first became available. (VIDEO-3576)
- Removed references to node dependencies that causes build errors on Angular and Vue. (VIDEO-9282)
- Fixed an issue where incorrect device was detected when using iPad in Desktop Website mode. (VIDEO-8282)

2.21.1 (March 22, 2022)
=======================

Bug Fixes
---------

- Fixed the issue where twilio-video.js does not build with the latest version of webpack and vite. (VIDEO-8609)

2.21.0 (March 8, 2022)
======================

New Features
------------

- twilio-video.js now supports WKWebView and SFSafariViewController on iOS version 14.3 or later. The [`isSupported` flag](https://sdk.twilio.com/js/video/releases/2.20.1/docs/module-twilio-video.html) relies partly on the [User-Agent string](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/User-Agent) to determine if twilio-video.js officially supports the user's browser. If your application modifies the default value for the User-Agent string, the new value should follow the [correct format](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/User-Agent#syntax).

  Additionally, for [iOS applications](https://developer.apple.com/documentation/avfoundation/cameras_and_media_capture/requesting_authorization_for_media_capture_on_ios), your application will need to include the [camera usage description](https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/Articles/CocoaKeys.html#//apple_ref/doc/plist/info/NSCameraUsageDescription), [microphone usage description](https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/Articles/CocoaKeys.html#//apple_ref/doc/uid/TP40009251-SW25) and [inline media playback](https://developer.apple.com/documentation/webkit/wkwebviewconfiguration/1614793-allowsinlinemediaplayback) in order for the SDK to work on WKWebView.

  Note: As with Safari, WKWebViews only support only one local media track of each kind at a time.

  We also would like to thank @cbxp for his [contribution](https://github.com/twilio/twilio-webrtc.js/pull/133). (VIDEO-8374)

Known Issue
-----------

Some [common issues](https://github.com/twilio/twilio-video.js/blob/master/COMMON_ISSUES.md#safari-mobile) such as interruptions on mobile devices which includes, backgrounding the application, or switching between applications can sometimes cause VideoTracks to go black or AudioTracks to stop.

2.20.1 (Feb 17, 2022)
=====================
Bug Fixes
---------

- Fixed a bug that was introduced in 2.19.0 where the published LocalVideoTracks of Participants on older iOS versions 14.5 and below did not encode and transmit media. (VIDEO-8770)

2.20.0 (February 10, 2022)
==========================

Changes
-------

The Preflight API ([runPreflight](https://sdk.twilio.com/js/video/releases/2.20.0/docs/module-twilio-video.html#.runPreflight__anchor)), originally released in [2.16.0](#2160-august-11-2021), has been promoted to GA.

Thank you @morninng @eroidaaruqaj [#1622](https://github.com/twilio/twilio-video.js/issues/1622) for your feedback. Based on this feedback, we have made the following changes to `runPreflight`. (VIDEO-7728)

- The [failed](https://sdk.twilio.com/js/video/releases/2.20.0/docs/PreflightTest.html#event:failed) event now provides a [PreflightTestReport](https://sdk.twilio.com/js/video/releases/2.20.0/docs/global.html#PreflightTestReport) which include partial results gathered during the test. Use this in addition to the error object to get more insights on the failure.

- Signaling and Media Connection errors are now properly surfaced via the [failed](https://sdk.twilio.com/js/video/releases/2.20.0/docs/PreflightTest.html#event:failed) event.

- [PreflightTestReport](https://sdk.twilio.com/js/video/releases/2.20.0/docs/global.html#PreflightTestReport) now includes a `progressEvents` property. This new property is an array of [PreflightProgress](https://sdk.twilio.com/js/video/releases/2.20.0/docs/global.html#PreflightProgress) events detected during the test. Use this information to determine which steps were completed and which ones were not.

You can learn more about `runPreflight` usage in the documentation, [here](https://twilio.com/docs/video/troubleshooting/preflight-api).

Other changes in this release includes:

- In [October 2019](#200-beta15-october-24-2019), twilio-video.js started using Unified Plan where available, while also maintaining support for earlier browser versions with Plan B as the default SDP format. With this release, twilio-video.js will now stop supporting the Plan B SDP format and will only support the Unified Plan SDP format. Please refer to this [changelog](#200-beta15-october-24-2019) and this [public advisory](https://support.twilio.com/hc/en-us/articles/360039098974-Upcoming-Breaking-Changes-in-Twilio-Video-JavaScript-SDK-Google-Chrome) for more related information. (VIDEO-6587)

2.19.1 (February 7, 2022)
=========================

Bug Fixes
---------

- Fixed a bug where media connection was not getting reconnected after a network interruption if participant was not subscribed to any tracks. (VIDEO-8315)
- Fixed a bug where network quality score stops updating after network glitches. (VIDEO-8413)

2.19.0 (January 31, 2022)
=========================

New Features
------------

- This release introduces a new feature **Adaptive Simulcast**. This opt-in feature can be enabled by setting `preferredVideoCodecs="auto"` in ConnectOptions. When joining a group room with this feature enabled, the SDK will use VP8 simulcast, and will enable/disable simulcast layers dynamically, thus improving bandwidth and CPU usage for the publishing client. It works best when used along with `Client Track Switch Off Control` and `Video Content Preferences`. These two flags allow the SFU to determine which simulcast layers are needed, thus allowing it to disable the layers not needed on publisher side. This feature cannot be used alongside `maxVideoBitrate`.

If your application is currently using VP8 simulcast we recommend that you switch to this option.

Example:

```ts
const { connect } = require('twilio-video');

const room = await connect(token, {
  preferredVideoCodecs: 'auto',
  bandwidthProfile: {
    video: {
      contentPreferencesMode: 'auto',
      clientTrackSwitchOffControl: 'auto'
    }
  }
});
```

Known Limitations
-----------------

- Specifying `preferredVideoCodecs="auto"` will revert to unicast in the following cases:
  - The publisher is using Firefox.
  - The publisher has preferred the H264 codec.
  - The Room is configured to support only the H264 codec.
  - Peer-to-Peer Rooms
- When the participant is being recorded, the SFU will not disable any simulcast layers of the participant's VideoTrack.

Bug Fixes
---------

- Fixed a bug where `clientTrackSwitchOffControl` and `contentPreferencesMode` sometimes did not work as expected during network glitches. (VIDEO-7654)

2.18.3 (January 4, 2022)
========================

Bug Fixes
---------

- Fixed a bug where connect was returning a Promise type instead of a CancelablePromise. (VIDEO-7831)
- Fixed a bug where `audioLevel`, `frameRate`, and `captureDimensions` WebRTC stats are returning null on certain browsers. With this release, these stats are now populated whenever they are available. (VIDEO-3600)

2.18.2 (December 15, 2021)
==========================

Bug Fixes
---------

- Fixed a bug where setting `clientTrackSwitchOffControl` to `auto` caused the RemoteVideoTracks to get switched off while playing in picture-in-picture mode. Note that this fix does not apply to Firefox as it does not yet implement [picture-in-picture](https://developer.mozilla.org/en-US/docs/Web/API/Picture-in-Picture_API) APIs. (VIDEO-6677)

2.18.1 (October 29, 2021)
=========================

Changes
-------

- Added some metrics to track the usage of the **Preflight API Public Beta** (`runPreflight`). There are no changes to the public APIs in this release. (VIDEO-6891)

2.18.0 (October 13, 2021)
=========================

New Features
------------

- When a LocalParticipant tries to publish a LocalVideoTrack in an [Audio Only Group Room](https://www.twilio.com/docs/video/api/rooms-resource#example-4-create-an-audio-only-group-room),
  it will fail with a [RoomTrackKindNotSupportedError](https://sdk.twilio.com/js/video/releases/2.18.0/docs/RoomTrackKindNotSupportedError.html). (VIDEO-7242)

Known Issue
------------

In Firefox, although the publishing of a LocalVideoTrack in an Audio Only Group Room fails,
the **RoomTrackKindNotSupportedError** is not raised. We are actively working on fixing this issue.

2.17.1 (September 21, 2021)
===========================
Bug Fixes
---------

- Fixed a regression in `2.17.0` which caused Chrome screen share tracks to be encoded at lower dimensions. (VIDEO-7000)

2.17.0 (September 14, 2021)
===========================
New Features
------------

- twilio-video.js now supports Chrome on iOS versions 14.3 and above. (VIDEO-5723)

Bug Fixes
---------

- Fixed a bug where the VideoTracks of Safari Participants with VP8 simulcast enabled sometimes had low frame rates. (VIDEO-6263)
- Fixed a bug where the screen share track got restarted as a camera track if it was ended when the application was foreground. (VIDEO-3977)

2.16.0 (August 11, 2021)
========================
**New Features**
-----------------------

This release includes the **Preflight API Public Beta** (`runPreflight`) to help test connectivity with Twilio servers. It can be used to detect issues prior to joining a Video Room or as part of a troubleshooting page.

The API connects two peer connections using Twilio's Signaling and TURN servers. It publishes synthetic audio and video tracks from one participant and ensures that other participant receives media on those tracks. After successfully verifying connectivity, it generates a report with information on the connection.

`runPreflight` was originally introduced as an experimental API in `2.8.0-beta1` and has been updated based on feedback. In short, usage of the API will now be free of charge.

Example:

```ts
const { runPreflight } = require('twilio-video');
const token = getAccessToken();

const preflightTest = runPreflight(token);

preflightTest.on('progress', (progress: string) => {
  console.log('preflight progress:', progress);
});

preflightTest.on('failed', (error: Error) => {
  console.error('preflight error:', error);
});

preflightTest.on('completed', (report: PreflightTestReport) => {
  console.log("Test completed in " + report.testTiming.duration + " milliseconds.");
  console.log(" It took " + report.networkTiming.connect?.duration + " milliseconds to connect");
  console.log(" It took " + report.networkTiming.media?.duration + " milliseconds to receive media");
});
```

The [PreflightTestReport](https://sdk.twilio.com/js/video/releases/2.16.0/docs/global.html#PreflightTestReport) generated by `preflightTest` on `completed` provides statistics that can be useful in cases where there is a poor connection. Some of the useful statistics in the report are as follows:

- Packet loss, round trip time, and jitter observed on the connection
- Network timing measurements on the `progress` events, such as time to connect or to receive media.
- Ice candidates and selected ice candidate pairs

`preflightTest` emits a `failed` event to indicate test failures. You can use the [PreflightProgress](https://sdk.stage.twilio.com/js/video/releases/2.16.0/docs/global.html#PreflightProgress) events to better understand where the test failed and refer to
[this guide](https://www.twilio.com/docs/video/build-js-video-application-recommendations-and-best-practices#connection-errors) for interpreting common errors.

A few things to note:

- This function uses <a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API"> web audio API's.</a> Browser's autoplay policies sometimes require user action before accessing these APIs. Please ensure that this API is called in response to user action like a button click.
- For testing limitations in available bandwidth, we recommend you use `testMediaConnectionBitrate` from the [RTC Diagnostics SDK](https://github.com/twilio/rtc-diagnostics).


Bug Fixes
---------
Fixed a bug where the SDK was holding on to internally maintained audio elements longer than needed, now they will be cleaned up once track has started. (VIDEO-6480)


2.15.3 (July 28, 2021)
======================

Bug Fixes
---------
Fixed a bug where the SDK was not cleaning up internally maintained media elements. This causes memory leaks on certain use cases such as reconnecting or republishing to a room (VIDEO-6336).

Additionally, Chrome 92 [started enforcing](https://chromium-review.googlesource.com/c/chromium/src/+/2816118) limit on number of WebMediaPlayers. This blocks creation of WebMediaPlayers once the limit is reached - 75 for desktop and 40 for mobile. This SDK update will help prevent running into this limit issue on use cases such as reconnecting or republishing to a room. Please ensure that your application cleans up media elements as well after they are detached.

```js
const elements = track.detach();
elements.forEach(el => {
  el.remove();
  el.srcObject = null;
});
```

Please be aware that your application may still run into the Chrome's WebMediaPlayers limit for large rooms where participants exceeds this limit.

2.15.2 (July 15, 2021)
======================

Bug Fixes
---------
Fixed a bug where setting clientTrackSwitchOffControl to `auto` caused the tracks to get switched off aggressively, which resulted in momentary black track during app layout changes (VIDEO-5226).

2.15.1 (June 21, 2021)
=====================

New Features
------------

_Updated June 24, 2021_

- The [Video Processor API](https://sdk.twilio.com/js/video/releases/2.15.1/docs/VideoTrack.html#addProcessor) has been promoted to GA. There are no changes to the API at this moment and we will continue to improve it on future releases.

Bug Fixes
---------

- Fixed a bug where twilio-video was throwing an exception in a server-side rendering application.

2.15.0 (June 16, 2021)
=====================

**Breaking Change on Video Processor API (Beta)**
-------------------------------------------------

[VideoProcessor.processFrame](https://sdk.twilio.com/js/video/releases/2.15.0/docs/global.html#VideoProcessor) method signature has been changed in order to improve the performance of the [Video Processor API](https://sdk.twilio.com/js/video/releases/2.15.0/docs/VideoTrack.html#addProcessor). With this update, the output frame buffer is now provided to the `processFrame` method which should be used to draw the processed frame.

Old signature:

```ts
processFrame(inputFrame: OffscreenCanvas)
  : Promise<OffscreenCanvas | null>
  | OffscreenCanvas | null;
```

New signature:

```ts
processFrame(inputFrameBuffer: OffscreenCanvas, outputFrameBuffer: HTMLCanvasElement)
  : Promise<void> | void;
```

Example:

```js
class GrayScaleProcessor {
  constructor(percentage) {
    this.percentage = percentage;
  }
  processFrame(inputFrameBuffer, outputFrameBuffer) {
    const context = outputFrameBuffer.getContext('2d');
    context.filter = `grayscale(${this.percentage}%)`;
    context.drawImage(inputFrameBuffer, 0, 0, inputFrameBuffer.width, inputFrameBuffer.height);
  }
}

Video.createLocalVideoTrack().then(function(videoTrack) {
  videoTrack.addProcessor(new GrayScaleProcessor(100));
});
```

Bug Fixes
---------

- Fixed a bug where `isSupported` was returning `true` on certain unsupported mobile browsers. With this release, `isSupported` should now return true only for the [browsers supported by twilio-video.js](https://www.twilio.com/docs/video/javascript#supported-browsers).

- Updated [NetworkQualityBandwidthStats](https://sdk.twilio.com/js/video/releases/2.14.0/docs/NetworkQualityBandwidthStats.html) documentation to reflect the correct bandwidth units, in bits per second, instead of bytes.

2.14.0 (May 11, 2021)
=====================

New Features
------------

This release contains a significant update to the Bandwidth Profile API. It allows for more efficient use of bandwidth and CPU in multi-party applications. In addition it provides developers with more dynamic control over which video tracks are delivered to the client and the preferred video resolution of the tracks. These capabilities are provided via the Client Track Switch Off Control and Content Preferences settings.

Existing Bandwidth Profile settings will continue to function as before, however we recommend developers update their Bandwidth Profile settings to make use of these new capabilities at their earliest convenience.

**Client Track Switch Off Control**

- This feature allows subscribers to control whether the media for a RemoteVideoTrack is received or not. Client Track Switch Off Control has two modes of operation:
  - **auto** (default): The SDK determines whether tracks should be switched off based on document visibility, track attachments, and / or the visibility of video elements.
  - **manual**: The application requests that individual tracks be switched off or on using the `RemoteVideoTrack.switchOff()` / `switchOn()` methods.
- Note: If your application previously set the `maxTracks` property to limit the number of tracks visible, you should migrate to using `clientTrackSwitchOffControl` to take advantage of this feature.

**Video Content Preferences**

- This feature allows subscribers to specify preferences about the media that they receive on a RemoteVideoTrack. Video content preferences has two modes of operation:
  - **auto** (default): The SDK specifies content preferences based on video element size. A RemoteVideoTrack attached to a video element with larger dimensions will get a higher quality video compared to a RemoteVideoTrack attached to a video element with smaller dimensions.
  - **manual**: The application specifies the content preferences for individual tracks using `RemoteVideoTrack.setContentPreferences()`.
- Note: If your application previously set the `renderDimensions` property, you should migrate to using `contentPreferencesMode` to take advantage of this feature.

Both of these features are available in Group Rooms and are enabled by default if your application specifies [Bandwidth Profile Options](https://media.twiliocdn.com/sdk/js/video/releases/2.14.0/docs/global.html#BandwidthProfileOptions__anchor) during connect.

  ```ts
  const { connect } = require('twilio-video');
  const room = await connect(token, {
    name: 'my-new-room',
    bandwidthProfile: {
      video: {
        /* Defaults to "auto" for both features. Be sure to remove "renderDimensions" and "maxTracks". */
      }
    }
  });
  ```

**Migrating to Attach APIs**

The automatic behaviors rely on applications using the [attach](https://media.twiliocdn.com/sdk/js/video/releases/2.12.0/docs/RemoteVideoTrack.html#attach__anchor) and [detach](https://media.twiliocdn.com/sdk/js/video/releases/2.12.0/docs/RemoteVideoTrack.html#detach__anchor) methods of `RemoteVideoTrack`. If your application currently uses the underlying `MediaStreamTrack` to associate Tracks to video elements, you will need to update your application to use the attach/detach methods or use the manual APIs.

**Manual Controls**

  ```ts
  const room = await connect(token, {
    bandwidthProfile: {
      video: {
        contentPreferencesMode: 'manual',
        clientTrackSwitchOffControl: 'manual'
      }
    }
  });
  ```

When manual controls are used you can operate directly on `RemoteVideoTrack` to specify preferences. For example, applications can:

1. Force disabling a track.

  ```ts
  remoteTrack.switchOff();
  ```

2. Enable and request QVGA video.

  ```ts
  # Only needed if switchOff() was called first.
  remoteTrack.switchOn();
  remoteTrack.setContentPreferences({
    renderDimensions: { width: 320, height: 240 }
  });
  ```

3. Request HD (720p) video.

  ```ts
  remoteTrack.setContentPreferences({
    renderDimensions: { width: 1280, height: 720 }
  });
  ```

- `clientTrackSwitchOffControl` Optional property (defaults to `"auto"`).  When omitted or set to "auto" switches off a `RemoteVideoTrack` when no video element is attached to the track, when all attached video elements of the track are not visible, or when the Document is not visible.

- `contentPreferencesMode` Optional property (defaults to `"auto"`). When omitted or set to `"auto"` allows the SDK to select video bitrate based on dimension information of the video elements attached to each `RemoteVideoTrack`.

- `renderDimensions` is deprecated and will raise a warning when set. Setting both `renderDimensions` and `contentPreferencesMode` is not allowed and will raise an exception.

- `maxTracks` is deprecated and will raise a warning when set. Setting both `maxTracks` and `clientTrackSwitchOffControl` is not allowed and will raise an exception.

Bug Fixes
---------

- Fixed a bug where loading `twilio-video.js` resulted in page errors on Firefox Galaxy S9 simulation mode. (VIDEO-4654)
- Fixed LocalDataTrackOptions TypeScript Definition to match documentation and extend properties from LocalTrackOptions. (VIDEO-5116)

2.13.1 (March 17, 2021)
=======================

New Features
------------

- The [Video Processor API](https://sdk.twilio.com/js/video/releases/2.13.0/docs/VideoTrack.html#addProcessor) has been promoted to beta. There are no changes to the API at this moment and we will continue to improve it on future releases.

Bug Fixes
---------

- Fixed a bug where Android Firefox Participants sometime failed to publish VP8 VideoTracks in a Group Room. (VIDEO-3736)

2.13.0 (March 3, 2021)
======================

New Features
------------

**Video Processor API Pilot (Chrome only)**
- You can now register a `VideoProcessor` with a VideoTrack in order to process its video frames. In a LocalVideoTrack, video frames are processed before being sent to the encoder. In a RemoteVideoTrack, video frames are processed before being sent to the attached `<video>` element(s). The `VideoProcessor` should implement the interface shown below. (VIDEO-3560, VIDEO-3561)

  ```ts
  abstract class VideoProcessor {
    abstract processFrame(inputFrame: OffscreenCanvas)
      : Promise<OffscreenCanvas | null>
      | OffscreenCanvas | null;
  }
  ```

  A VideoTrack provides new methods [addProcessor](https://sdk.twilio.com/js/video/releases/2.13.0/docs/VideoTrack.html#addProcessor) and [removeProcessor](https://sdk.twilio.com/js/video/releases/2.13.0/docs/VideoTrack.html#removeProcessor) which can be used to add and remove a VideoProcessor. It also provides a new property `processor` which points to the current VideoProcessor being used by the VideoTrack. For example, you can toggle a blur filter on a LocalVideoTrack as shown below.

  ```ts
  import { createLocalVideoTrack } from 'twilio-video';

  class BlurVideoProcessor {
    private readonly _outputFrameCtx: CanvasRenderingContext2D;
    private readonly _outputFrame: OffscreenCanvas;

    constructor(width: number, height: number, blurRadius: number) {
      this._outputFrame = new OffscreenCanvas(width, height);
      this._outputFrameCtx = this._outputFrame.getContext('2d');
      this._outputFrameCtx.filter = `blur(${blurRadius}px)`;
    }

    processFrame(inputFrame: OffscreenCanvas) {
      this._outputFrameCtx.drawImage(inputFrame, 0, 0);
      return this._outputFrame;
    }
  }

  // Local video track
  createLocalVideoTrack({
    width: 1280,
    height: 720
  }).then(track => {
    const processor = new BlurVideoProcessor(1280, 720, 5);
    document.getElementById('preview').appendChild(track.attach());
    document.getElementById('toggle-blur').onclick = () => track.processor
      ? track.removeProcessor(processor)
      : track.addProcessor(processor);
  });

  ```

  You can also toggle a blur filter on a RemoteVideoTrack as shown below.

  ```js
  room.on('trackSubscribed', track => {
    if (track.kind === 'video') {
      const { width, height } = track.dimensions;
      const processor = new BlurVideoProcessor(width, height, 3);
      document.getElementById('preview-remote').appendChild(track.attach());
      document.getElementById('toggle-blur-remote').onclick = () => track.processor
        ? track.removeProcessor(processor)
        : track.addProcessor(processor);
    }
  });
  ```

2.12.0 (Feb 10, 2021)
=====================

New Features
------------

**100 Participant Rooms Pilot**
- In this pilot program developers can connect to a Group Room with Maximum Participants set between 50 and 100.
  A Room created with Max Participants greater than 50 is structured to support a small number of presenters and a large number of viewers. It has the following behavioral differences compared to regular Group Rooms:
  - "participantConnected" event is raised on the Room when a RemoteParticipant
    publishes the first LocalTrack.
  - "participantDisconnected" event is raised on the Room when a RemoteParticipant
    stops publishing all of its LocalTracks.
  - The total number of published Tracks in the Room cannot exceed 16 at any one time. Any attempt
    to publish more Tracks will be rejected with a `ParticipantMaxTracksExceededError`. (JSDK-3021)


Bug Fixes
---------

- Fixed a bug where calling `LocalMediaTrack.restart()` logged a warning about PeerConnection being closed in Peer to Peer Rooms. (JSDK-2912)
- Fixed a race condition that sometimes caused `switchedOff` event for `RemoteVideoTrack` to not get emitted, which also resulted in wrong value for `RemoteVideoTrack.isSwitchedOff` property. (VIDEO-3695)

2.11.0 (January 26, 2021)
=========================

- You can now import type definitions for the SDK APIs to your project. Previously, typescript developers relied on [definitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/1a7a99db8ec25d48f3dfec146af742e5bc40a5f7/types/twilio-video/index.d.ts) for these definitions. We would like to thank the folks at DefinitelyTyped for maintaining these definitions. Going forward, the definitions will be included in the library and will take precedence over any other type definitions that you may be using. (JSDK-3007)

You can access the types of the public API classes from the `Video` namespace as shown below:
```ts
import * as Video from 'twilio-video';

Video.connect('token', { name: 'my-cool-room' }).then((room: Video.Room) => {
  console.log('Connected to Room:', room.name);
  room.on('participantConnected', (participant: Video.RemoteParticipant) => {
    console.log('RemoteParticipant joined:', participant.identity);
  });
});
```

Bug Fixes
---------

- Fixed a bug where the `Video` namespace is not exported properly when using RequireJS. (JSDK-3129)

2.10.0 (December 10, 2020)
==========================

New Features
------------

- You can now intercept logs generated by twilio-video.js using the [loglevel](https://www.npmjs.com/package/loglevel) module. This allows for real-time processing of the logs which include but not limited to inspecting the log data and sending it to your own server. (JSDK-2373)

  `ConnectOptions`'s `logLevel` property is now deprecated. You can instead use `logger.setLevel` to set the desired log level.
  ```js
  var { Logger, connect } = require('twilio-video');
  var logger = Logger.getLogger('twilio-video');

  // setLevel lets you to control what gets printed on console logs by twilio-video.
  logger.setLevel('debug');
  connect(token, {
    name: 'my-cool-room'
  }).then(function(room) {
    room.on('participantConnected', function(participant) {
      console.log(participant.identity + ' has connected');
    });
  }).catch(error => {
    console.log('Could not connect to the Room:', error.message);
  });
  ```

  Additionally, `ConnectOptions`'s `eventListener` property is now deprecated. You can listen for the signaling events by intercepting the logger's messages as shown in the example below. (JSDK-2977)

  Example:

  ```js
  var { Logger, connect } = require('twilio-video');
  var token = getAccessToken();

  var logger = Logger.getLogger('twilio-video');

  // Listen for logs
  var originalFactory = logger.methodFactory;
  logger.methodFactory = function (methodName, level, loggerName) {
    var method = originalFactory(methodName, level, loggerName);

    return function (datetime, logLevel, component, message, data) {
      method(datetime, logLevel, component, message, data);
      // check for signaling events that previously used to be
      // emitted on (now deprecated) eventListener
      // they are fired with message = `event`, and group == `signaling`
      if (message === 'event' && data.group === 'signaling') {
        if (data.name === 'waiting') {
          console.warn('Twilio\'s signaling server is busy, so we wait a little while before trying again.');
        } else if (data.name === 'connecting') {
          console.log('Connecting to Twilio\'s signaling server.');
        } else if (data.name === 'open') {
          console.log('Connected to Twilio\'s signaling server, joining the Room now.');
        } else if (data.name === 'closed') {
          if (data.level === 'error') {
            const { payload: { reason } } = data;
            console.error('Connection to Twilio\'s signaling server abruptly closed:', data.reason);
          } else {
            console.log('Connection to Twilio\'s signaling server closed.');
          }
        }
      }
    };
  };

  // you need to setLevel to info (or debug) in order to intercept signaling events.
  logger.setLevel('info');
  connect(token, {
    name: 'my-cool-room'
  }).then(function(room) {
    room.on('participantConnected', function(participant) {
      console.log(participant.identity + ' has connected');
    });
  }).catch(error => {
    console.log('Could not connect to the Room:', error.message);
  });
  ```

2.9.0 (December 2, 2020)
========================

Changes
-------

- Previously, `Room.isRecording` indicated whether recording is enabled for the Room.
Now it indicates if the Track published to the Room are being recorded. If recording is
enabled for the Room, then `Room.isRecording` is set to `true` when the first Track is published
to the Room. It is set to `false` when the last Track is unpublished from the Room.
The `recordingStarted` and `recordingStopped` events will be emitted on the Room
when `Room.isRecording` toggles. (JSDK-3064)

Bug Fixes
---------

- Fixed a bug where LocalTrack event listeners attached by the SDK were not being cleaned up after disconnecting from a Room. (JSDK-2985)

2.8.0 (November 20, 2020)
=========================

New Features
------------

- Enabled discontinuous transmission (DTX) in the Opus audio codec by default, which
  will result in bandwidth and CPU savings during silence and background noise. You
  can control this feature using the ConnectOptions property `preferredAudioCodecs`. (JSDK-3022)

  ```js
  const { connect } = require('twilio-video');

  // Disable DTX for Opus.
  connect('token', {
    preferredAudioCodecs: [{ codec: 'opus', dtx: false }]
  });
  ```

Bug Fixes
---------

- Fixed a bug where Chrome Participants failed to restart a LocalAudioTrack or LocalVideoTrack
  on some android devices. (JSDK-3003)
- Fixed a bug where sometimes Tracks that were added in quick succession were not published due
  to a race condition. (JSDK-2807)

2.7.3 (October 21, 2020)
========================

Bug Fixes
---------

- Fixed a bug where an iOS 14 Safari Participant is not heard by others in a Room after
  handling an incoming phone call. (JSDK-3031)

2.7.2 (August 12, 2020)
=======================

Bug Fixes
---------

- Fixed a bug where a Participant in a large Group Room sometimes gets inadvertently
  disconnected with a [MediaServerRemoteDescFailedError](https://sdk.twilio.com/js/video/releases/2.7.2/docs/MediaServerRemoteDescFailedError.html). (JSDK-2893)

- Fixed a bug where `Room.getStats()` returned stats for only one of the temporal
  layers of a VP8 simulcast VideoTrack. Now, you will have a `LocalVideoTrackStats`
  object for each temporal layer, which you can recognize by the `trackId` and
  `trackSid` properties. (JSDK-2920)

  ```js
  async function getBytesSentOnLocalVideoTrack(room, trackSid) {
    const stats = await room.getStats();
    let totalBytesSent = 0;
    stats.forEach(stat => {
      totalBytesSent += stat.localVideoTrackStats
        .filter(localVideoTrackStats => trackSid === localVideoTrackStats.trackSid)
        .reduce((bytesSent, localVideoTrackStats) => bytesSent + localVideoTrackStats.bytesSent, 0);
    });
    return totalBytesSent;
  }
  ```

2.7.1 (July 28, 2020)
=====================

Bug Fixes
---------

- Fixed a bug where, sometimes an iOS Safari Participant is not heard by others in
  a Room after handling an incoming phone call. (JSDK-2932)
- In version [2.6.0](#260-june-26-2020), we had introduced a workaround for this iOS Safari
  [bug](https://bugs.webkit.org/show_bug.cgi?id=208516) which causes your application to lose
  the microphone when another application (Siri, YouTube, FaceTime, etc.) reserves the microphone.
  This release refactors the workaround to work for **iOS versions 13.6 and above**. (JSDK-2928)
- Fixed a bug where, sometimes an iOS Safari Participant's `<audio>` and `<video>`
  elements were paused after handling an incoming phone call. Because of this,
  RemoteParticipants could not be seen and/or heard. (JSDK-2899)
- Fixed a bug where iOS Safari Participants stopped sending video frames after an
  incoming phone call. (JSDK-2915)
- Fixed a bug where audio only Firefox 79+ and Chrome Participants could not hear
  each other in a Peer to Peer Room due to this [Chromium bug](https://bugs.chromium.org/p/chromium/issues/detail?id=1106157). (JSDK-2914)
- Fixed a bug where `isSupported` returned `false` for Android Chrome browser on
  Motorola phones. (JSDK-2878)

2.7.0 (July 8, 2020)
====================

New Features
------------

- Previously, if you wanted to change the MediaTrackConstraints of an audio or video
  LocalTrack that is published to a Room, you would have to unpublish it, create a new
  LocalTrack with the desired MediaTrackConstraints and publish it to the Room. Now,
  you can just `restart` the LocalTrack with the desired MediaTrackConstraints. For details,
  please refer to the [LocaAudioTrack.restart()](https://sdk.twilio.com/js/video/releases/2.7.0/docs/LocalAudioTrack.html#restart__anchor)
  and [LocalVideoTrack.restart()](https://sdk.twilio.com/js/video/releases/2.7.0/docs/LocalVideoTrack.html#restart__anchor)
  documentation. (JSDK-2870)

Bug Fixes
---------

- Restored es5 support which was broken in 2.5.0. (JSDK-2913)

2.6.0 (June 26, 2020)
=====================

Changes
-------

- Worked around this iOS Safari [bug](https://bugs.webkit.org/show_bug.cgi?id=208516) which causes your
  application to lose the microphone when another application (Siri, YouTube, FaceTime, etc.) reserves the
  microphone. Now your application will regain the microphone after foregrounding. As a result of this, the
  LocalAudioTrack's `mediaStreamTrack` property will now point to the newly acquired MediaStreamTrack, and
  the `started` event is fired again on the LocalAudioTrack. The `id` of the LocalAudioTrack is now no longer
  guaranteed to be equal to the `id` of the MediaStreamTrack. Also, if you want to listen to events on the
  MediaStreamTrack, we recommend that you do so in the `started` event handler, since it guarantees that you
  are always listening to events on the most recently acquired MediaStreamTrack. (JSDK-2828)

```js
const { createLocalAudioTrack } = require('twilio-video');

const localAudioTrack = await createLocalAudioTrack();

function onMute() {
  console.log('MediaStreamTrack muted!');
}

function onUnmute() {
  console.log('MediaStreamTrack unmuted!');
}

localAudioTrack.on('started', () => {
  const { mediaStreamTrack } = localAudioTrack;
  mediaStreamTrack.addEventListener('mute', onMute);
  mediaStreamTrack.addEventListener('unmute', onUnmute);
});

localAudioTrack.on('stopped', () => {
  const { mediaStreamTrack } = localAudioTrack;
  mediaStreamTrack.removeEventListener('mute', onMute);
  mediaStreamTrack.removeEventListener('unmute', onUnmute);
});
```

- Worked around this iOS Safari [bug](https://bugs.webkit.org/show_bug.cgi?id=212780) where, when the application is foregrounded,
  it sometimes does not resume playback of the HTMLMediaElements attached to RemoteTracks that are paused when the application
  is backgrounded. (JSDK-2879)

2.5.1 (June 5, 2020)
====================

Changes
-------

- Removed support for versions of Chrome (23 - 55) and Firefox (22 - 43) that support prefixed
  versions of the WebRTC APIs that have been deprecated. `isSupported` will now return `false`
  for these browser versions. (JSDK-2832)

Bug Fixes
---------

- Moved npm dependencies `chromedriver` and `puppeteer` to `devDependencies` from `optionalDependencies`. (JSDK-2848)

2.5.0 (May 27, 2020)
====================

New Features
------------

- The client now retries connection attempts when `connect()` is called and the signaling server is busy. The client may attempt
  one or more connection attempts with a server specified backoff period. If the client exceeds all attempts
  the CancelablePromise is rejected with a [SignalingServerBusyError](https://sdk.twilio.com/js/video/releases/2.5.0/docs/SignalingServerBusyError.html).
  The status of the signaling connection can now be monitored by passing an [EventListener](https://sdk.twilio.com/js/video/releases/2.5.0/docs/global.html#EventListener__anchor)
  in ConnectOptions as shown in the code snippet below. Each event is documented [here](https://sdk.twilio.com/js/video/releases/2.5.0/docs/global.html#EventListenerEvent). (JSDK-2777)

  ```js
  const { EventEmitter } = require('events');
  const { connect } = require('twilio-video');

  const sdkEvents = new EventEmitter();

  // Listen to events on the EventListener in order to monitor the status
   // of the connection to Twilio's signaling server.
  sdkEvents.on('event', event => {
    const { level, name } = event;
    if (name === 'waiting') {
      assert.equal(level, 'warning');
      console.warn('Twilio\'s signaling server is busy, so we wait a little while before trying again.');
    } else if (name === 'connecting') {
      assert.equal(level, 'info');
      console.log('Connecting to Twilio\'s signaling server.');
    } else if (name === 'open') {
      assert.equal(level, 'info');
      console.log('Connected to Twilio\'s signaling server, joining the Room now.');
    } else if (name === 'closed') {
      if (level === 'error') {
        const { payload: { reason } } = event;
        console.error('Connection to Twilio\'s signaling server abruptly closed:', reason);
      } else {
        console.log('Connection to Twilio\'s signaling server closed.');
      }
    }
  });

  connect('token', { eventListener: sdkEvents }).then(room => {
    console.log('Joined the Room:', room.name);
  }, error => {
    if (error.code === 53006) {
      console.error('Twilio\'s signaling server cannot accept connection requests at this time.');
    }
  });
  ```

- Reduced connection times by acquiring RTCIceServers during the initial handshake with Twilio's
  signaling server rather than sending a HTTP POST request to a different endpoint. Because of this,
  the ConnectOptions properties `abortOnIceServersTimeout` and `iceServersTimeout` are no longer
  applicable, and they will be ignored. (JSDK-2676)

- Reduced connection times by removing a round trip during the initial handshake with Twilio's
  signaling server. (JSDK-2777)

- The CancelablePromise returned by `connect()` will now be rejected with a [SignalingConnectionError](https://www.twilio.com/docs/api/errors/53000)
  if the underlying WebSocket connection to Twilio's signaling server is not open in 15 seconds. (JSDK-2684)

Bug Fixes
---------

- Fixed a bug where `isSupported` was throwing an exception in a server-side rendering application. (JSDK-2818)
- Fixed a bug where sometimes the publishing of a LocalTrack very quickly after another LocalTrack was unpublished
  never completed. (JSDK-2769)
- Fixed a bug in `Room.getStats()` where it did not return correct values for `packetsLost`, `roundTripTime` for
  LocalTracks. (JSDK-2755, JSDK-2780, JSDK-2787)

2.4.0 (May 4, 2020)
===================

New Features
------------

- twilio-video.js now supports faster signaling reconnections due to network disruption or handoff. (JSDK-2739)
- twilio-video.js now supports faster media reconnections due to network disruption or handoff. (JSDK-2742)

Bug Fixes
---------

- Worked around this Chromium [bug](https://bugs.chromium.org/p/chromium/issues/detail?id=1074421),
  which causes Android Chrome 81+ Participants to not be able to subscribe to H264 RemoteVideoTracks
  in a Group or Small Group Room. (JSDK-2779)
- Fixed a bug where `Video.isSupported` was returning `true` for some browsers that
  are not officially supported by twilio-video.js. (JSDK-2756)

2.3.0 (March 19, 2020)
======================

New Features
------------

- `reconnecting` and `reconnected` events on Room and LocalParticipant are now fired asynchronously. (JSDK-2696)
- twilio-video.js now raises `connect()` errors due to network disruptions quicker by not retrying after the first connection attempt fails. (JSDK-2682)
- twilio-video.js attempts to reconnect to a Room only while the Participant's session is valid (typically 30 seconds after the `reconnecting` event) instead of using a fixed number of retries. (JSDK-2683)
- A LocalParticipant will now have an additional `signalingRegion` property which contains the geographical region of the signaling edge LocalParticipant is connected to. (JSDK-2687)
- A Room will now have an additional `mediaRegion` property which is where media is being processed. This property is not set for Peer-to-Peer Rooms because they do not use a central media server for routing and/or recording. (JSDK-2685)

Bug Fixes
---------

- Fixed a bug where calling `setPriority` on RemoteVideoTracks of RemoteParticipants that joined after the LocalParticipant had no effect. (JSDK-2707)

2.2.0 (February 21, 2020)
=========================

New Features
------------

- You will now be disconnected from a Room with a `MediaDTLSTransportFailedError` (error code 53407)
  when media cannot published to the Room due to a DTLS handshake failure. (JSDK-2552)
- Media reconnections are now time-bound. Now, if the media connection to the Room
  is not recovered after a certain time period, which is 30 seconds for now, then you
  will be disconnected from the Room with a `MediaConnectionError` (error code 53405). (JSDK-2552)

Bug Fixes
---------

- Fixed a bug where switching between networks (or connecting to VPN) sometimes caused media flow to stop. (JSDK-2667)
- Fixed a bug where twilio-video.js failed to load due to a TypeError on Chrome iOS. (JSDK-2670)

2.1.0 (February 4, 2020)
========================

New Features
------------

- A RemoteParticipant will now emit a "reconnecting" event when it is trying to
  re-establish its signaling connection to the Room after a network disruption/handoff.
  Once it has successfully reconnected to the Room, it will emit a "reconnected"
  event. (JSDK-2662)

  ```js
  function reconnecting(participant) {
    console.log(`${participant.identity} is rejoining the Room`);
    assert.equal(participant.state, 'reconnecting');
  }

  function reconnected(participant) {
    console.log(`${participant.identity} has rejoined the Room`);
    assert.equal(participant.state, 'connected');
  }

  room.on('participantConnected', participant => {
    participant.on('reconnecting', () => {
      reconnecting(participant);
    });

    participant.on('reconnected', () => {
      reconnected(participant);
    });
  });

  // You can also listen to these events at the Room level.
  room.on('participantReconnecting', participant => {
    reconnecting(participant);
  });

  room.on('participantReconnected', participant => {
    reconnected(participant);
  });
  ```

  *NOTE*: It can take up to 15 seconds for our signaling backend to detect that a
  RemoteParticipant's connection has been disrupted due to a network degradation or
  handoff. This is because we don't want to be too aggressive in attempting reconnections.
  We encourage you to reach out to us with any feedback you may have in terms of the
  effect of this delay on your application's user experience.

  The LocalParticipant will now also emit "reconnecting" and "reconnected" events
  when the local client is recovering/successfully recovered from a signaling connection
  disruption:

  ```js
  const { localParticipant } = room;

  localParticipant.on('reconnecting', () => {
    reconnecting(localParticipant);
  });

  localParticipant.on('reconnected', () => {
    reconnected(localParticipant);
  });
  ```

2.0.1 (January 21, 2020)
========================

New Features
------------

- `Video.isSupported` now returns `true` for [Chromium-based Edge](https://www.microsoftedgeinsider.com/). (JSDK-2633)
- Support for Safari is no longer experimental. Hence, twilio-video.js will not log
  a console warning in Safari 12.1+. (JSDK-2635)

Bug Fixes
---------

- Fixed a bug where Room.getStats() sometimes returned null stats in a Peer-to-Peer
  Room on Chrome 81+. (JSDK-2639)

2.0.0 (December 20, 2019)
=========================

2.0.0-beta16 has been promoted to 2.0.0 GA and Network Bandwidth Profile is also GA! Thank you to all our beta users and for all the feedback you sent us during the beta period.

About Twilio Video JS SDK 2.0
-----------------------------

Twilio Video Javascript SDK 2.0 introduces the [Track Priority](https://www.twilio.com/docs/video/tutorials/using-track-priority-api) API, [Network Bandwidth Profile](https://www.twilio.com/docs/video/tutorials/using-bandwidth-profile-api) API, [Reconnection States and Events](https://www.twilio.com/docs/video/reconnection-states-and-events), and the [Region Selection](https://www.twilio.com/docs/video/tutorials/video-regions-and-global-low-latency) API.

[Track Priority](https://www.twilio.com/docs/video/tutorials/using-track-priority-api) and [Network Bandwidth Profile](https://www.twilio.com/docs/video/tutorials/using-bandwidth-profile-api) API gives developers the ability to specify how bandwidth should be allocated between the video tracks. Furthermore, the three profiles, (“grid”, “collaboration”, and “presentation”), specify when tracks should be switched off (or not) to conserve bandwidth for the highest priority tracks.

The [Reconnection States and Events](https://www.twilio.com/docs/video/reconnection-states-and-events) will automatically attempt to reconnect when a transient network error is encountered.

With [Region Selection](https://www.twilio.com/docs/video/tutorials/video-regions-and-global-low-latency) API, the SDK will automatically connect to the lowest latency data center. This API can also be configured to connect to a specific data center for cases where compliance might be required.

If migrating from a 1.x version, please refer to our [migration guide](https://www.twilio.com/docs/video/migrating-1x-2x).

To get started with Twilio Video JS, check our [Getting Started Guide](https://www.twilio.com/docs/video/javascript-v2-getting-started)

2.0.0-beta16 (December 10, 2019)
================================

New Features
------------

- This release supports all the features of the [Track Priority and Bandwidth Profile APIs](https://www.twilio.com/docs/video/migrating-1x-2x#track-priority-and-bandwidth-profiles-group-rooms-only-private-beta).

- You can now specify the mode to control Track switch off behavior by specifying a
  property `trackSwitchOffMode` in BandwidthProfileOptions.
  `trackSwitchOffMode` can be set to one of
  - `detected`  - In this mode, RemoteVideoTracks are switched off only when network congestion
                is detected.
  - `predicted` - In this mode, RemoteVideoTracks are pro-actively switched off when network
                congestion is predicted by the bandwidth estimation mechanism. This mode
                is used by default if not specified.
  - `disabled`  - In this mode, RemoteVideoTracks will not be switched off. Instead tracks
                will be adjusted to lower quality. (JSDK-2549)

  ```js
  const { connect } = require('twilio-video');
  const room = await connect(token, {
    bandwidthProfile: {
      video: {
        dominantSpeakerPriority: 'high',
        maxTracks: 2,
        mode: 'collaboration'
        trackSwitchOffMode: 'detected' // possible values: "predicted", "detected" or "disabled".
      }
    }
  });
  ```

- You can now change the priority of an already published LocalTrack using a new method
  `setPriority` on the corresponding LocalTrackPublication. (JSDK-2442)

  ```js
  const localTrackPublication = await room.localParticipant.publishTrack(localTrack, {
    priority: 'high' // LocalTrack's publish priority - "low", "standard" or "high"
  });

  // After a while, change the priority to "low".
  localTrackPublication.setPriority(`low`);
  ```

  This will update `publishPriority` on all corresponding RemoteTrackPublications and
  emit a new event "publishPriorityChanged" to notify the user:

  ```js
  remoteTrackPublication.on('publishPriorityChanged', priority => {
    console.log(`The publisher has changed the priority this Track to "${priority}"`);
    assert.equal(remoteTrackPublication.publishPriority, priority);
  });

- In a **Group Room**, You can now override for yourself the priority of a RemoteTrack set by the publisher
   by using a new method `setPriority`. (JSDK-2347)

  ```js
    remoteTrack.setPriority('high');
  ```

- If you want to revert back to the priority set by the publisher, you can do so as shown below:

  ```js
    remoteTrack.setPriority(null);
  ```

Bug Fixes
---------
- Worked around an issue in chrome where it would sometimes stop sending updates on screen-share track if `maxVideoBitrate` was set for the track.
You can limit bitrates on outgoing tracks using [Localparticipant.setParameters](https://sdk.twilio.com/js/video/releases/2.0.0-beta16/docs/LocalParticipant.html#setParameters__anchor) api. With this workaround, any bitrates set will not be applied to screen share track on chrome. (JSDK-2557)

- Fixed a race condition, that would sometimes cause a track to not get published if multiple tracks were added in quick succession (JSDK-2573)

- Fixed a bug where `publishPriorityChanged`, `trackDisabled` and `trackEnabled` events were getting fired for initial track state (JSDK-2603)

- Fixed an issue where loading twilio-video.js in firefox with `media.peerconnection.enabled` set to false in `about:config` caused page errors. (JSDK-2591)

2.0.0-beta15 (October 24, 2019)
===============================

New Features
------------

- twilio-video.js will now support the Unified Plan SDP format for Google Chrome. Google Chrome
  enabled Unified Plan as the default SDP format starting from version 72. In December 2018, we
  published an [advisory](https://support.twilio.com/hc/en-us/articles/360012782494-Breaking-Changes-in-Twilio-Video-JavaScript-SDKs-December-2018-)
  recommending customers to upgrade to the latest versions of twilio-video.js in order to not be
  affected by Google Chrome switching to Unified Plan starting from version 72. The way we ensured
  support of newer versions of Google Chrome in the versions of twilio-video.js released between
  December 2018 and now was by overriding the default SDP format to Plan B. Starting with this version,
  twilio-video.js will use Unified Plan where available, while also maintaining support for earlier
  browser versions with Plan B as the default SDP format. (JSDK-2312)

  **NOTE:**

  Since Unified Plan SDPs are usually larger than Plan B SDPs, this will lead to some increased signaling
  traffic whenever Participants join/leave a Room or publish/unpublish Tracks. Our load tests using Group
  Rooms with 35+ Participants revealed between 45% to 160% increase in peak signaling traffic. We did not
  notice any significant change in the media traffic. We also noticed about a 20% increase in peak CPU usage,
  which may be partly due to the browser having to process the larger Unified Plan SDPs. Please reach out to
  [support@twilio.com](mailto:support@twilio.com) to report any issues you may experience while adopting
  this release.

- Worked around a bug in [Chrome](https://bugs.chromium.org/p/chromium/issues/detail?id=749928)
  and Safari where browser continued to play WebRTC-based MediaStreamTrack even after
  corresponding `audio` element was removed from the DOM. With this fix twilio-video.js
  now disables any RemoteMediaTrack when it's not attached to any media elements. (JSDK-2490)

Bug Fixes
---------

- Fixed a bug where `Video.isSupported` evaluated to `true` on Chromium-based Edge browser,
  even though twilio-video.js does not support it at this moment. (JSDK-2515)

2.0.0-beta14 (September 17, 2019)
=================================

New Features
------------

- In a **Group Room**, you can now control how your available downlink bandwidth is
  distributed among the RemoteVideoTracks that you have subscribed to. twilio-video.js
  introduces the **Bandwidth Profile APIs**. Note that this feature is currently in
  **private beta** and hence will be **opt-in**. Please reach out to [video-product@twilio.com](mailto:video-product@twilio.com)
  for more information about how to enable these APIs for your Twilio Account.
  **Using these APIs in a Peer-to-Peer Room will have no effect**.

  ### Bandwidth Profile (private beta)

  You can now configure how your available downlink bandwidth will be distributed
  among your subscribed RemoteVideoTracks by using a new optional ConnectOptions
  parameter `bandwidthProfile`. For more details, please refer to the `BandwidthProfileOptions`
  [documentation](//sdk.twilio.com/js/video/releases/2.0.0-beta14/docs/global.html#BandwidthProfileOptions).
  Here is an example:

  ```js
  const { connect } = require('twilio-video');
  const room = await connect(token, {
    bandwidthProfile: {
      video: {
        dominantSpeakerPriority: 'high', // Min. subscribe priority of Dominant Speaker's RemoteVideoTracks.
        maxSubscriptionBitrate: 150000, // Max. bandwidth (bps) to be allocated to subscribed RemoteVideoTracks.
        maxTracks: 3, // Max. number of visible RemoteVideoTracks. Other RemoteVideoTracks will be switched off.
        mode: 'collaboration', // Subscription mode: "collaboration", "grid" or "presentation".
        renderDimensions: {
          low: { // Desired render dimensions of RemoteVideoTracks with priority "low".
            width: 320,
            height: 240
          },
          standard: { // Desired render dimensions of RemoteVideoTracks with priority "standard".
            width: 640,
            height: 480
          },
          high: { // Desired render dimensions of RemoteVideoTracks with priority "high".
            width: 1080,
            height: 720
          }
        }
      }
    }
  });
  ```

  ### Track Priority (private beta)

  While publishing a LocalTrack, you can now optionally specify its publish priority
  in the following way:

  ```js
  const localTrackPublication = await room.localParticipant.publishTrack(localTrack, {
    priority: 'high' // LocalTrack's publish priority - "low", "standard" or "high"
  });

  // LocalTrackPublication has a new property "priority" which stores the publish
  // priority set while publishing the corresponding LocalTrack.
  assert.equal(localTrackPublication.priority, 'high');
  ```

  This signals to the media server the relative importance of this LocalTrack with respect
  to other Tracks that may be published to the Room. The media server takes this into
  account while allocating a subscribing RemoteParticipant's bandwidth to the corresponding
  RemoteTrack. If you do not specify a priority, then it defaults to `standard`.

  You can also find out about the priorities of RemoteTracks published by other
  RemoteParticipants by accessing a new property `publishPriority` on the corresponding
  RemoteTrackPublications:

  ```js
  remoteParticipant.on('trackPublished', remoteTrackPublication => {
    console.log(`RemoteParticipant published a Track with priority ${remoteTrackPublication.publishPriority}`);
  });
  ```

  ### Switching on/off RemoteVideoTracks (private beta)

  When a subscribing Participant's downlink bandwidth is insufficient, the media server
  tries to preserve higher priority RemoteVideoTracks by switching off lower priority
  RemoteVideoTracks, which will stop receiving media until the media server decides
  to switch them back on. You can now get notified about these actions by listening
  to the `switchedOff` and `switchedOn` events on the RemoteVideoTrack:

  ```js
  remoteTrackPublication.on('subscribed', remoteTrack => {
    remoteTrack.on('switchedOff', () => {
      // You can now determine whether a particular RemoteTrack is switched off.
      assert.equal(remoteTrack.isSwitchedOff, true);
      console.log(`The RemoteTrack ${remoteTrack.name} was switched off`);
    });

    remoteTrack.on('switchedOn', () => {
      assert.equal(remoteTrack.isSwitchedOff, false);
      console.log(`The RemoteTrack ${remoteTrack.name} was switched on`);
    });
  });
  ```

Bug Fixes
---------

- Fixed a bug where LocalVideoTracks were being published at a very low bitrate even
  when there was sufficient bandwidth to publish at higher bitrates. (JSDK-2509)

2.0.0-beta13 (August 29, 2019)
==============================

New Features
------------

- You can now enable [DSCP tagging](https://tools.ietf.org/html/draft-ietf-tsvwg-rtcweb-qos-18) for media
  packets by setting a new ConnectOptions property `enableDscp` to `true`. DSCP tagging allows you to request
  enhanced QoS treatment for media packets from any firewall/routers that support this feature. Setting this
  option to `true` will request DSCP tagging for media packets on supported browsers (only Chrome supports this as of now).
  Audio packets will be sent with DSCP header value set to `0xb8` which corresponds to EF = Expedited Forwarding.
  Video packets will be sent with DSCP header value set to `0x88` which corresponds to AF41 = Assured Forwarding. (JSDK-2456)

  ```js
  const { connect } = require('twilio-video');
  const room = await connect(token, {
    enableDscp: true
  });
  ```

- The ConnectOptions flag `dscpTagging` which was introduced in 1.19.0 has now been renamed
  to `enableDscp`. Using the old name still works, but is deprecated and scheduled for removal. (JSDK-2492)

- Setting bandwidth limits for media using `LocalParticipant.setParameters()` will now no longer require a
  round of negotiation with the remote peer and will take effect instantaneously. (JSDK-2460)

Bug Fixes
---------

- Worked around a minor interop issue between Chrome/Safari Participants and Firefox 68+
  Participants in a Peer-to-Peer Room. Although this issue does no affect the normal
  functioning of the Room, it resulted in the Chrome/Safari Participants logging cryptic
  Error messages to the JavaScript console. Now, twilio-video.js will log warning messages
  until Chrome ([bug](https://bugs.chromium.org/p/chromium/issues/detail?id=978582)) and
  Safari fix this issue. (JSDK-2412)
- Fixed a bug where connecting to a Room with a `region` containing special characters in
  ConnectOptions failed with an Error other than [SignalingConnectionError](https://www.twilio.com/docs/api/errors/53000). (JSDK-2400)

2.0.0-beta12 (July 12, 2019)
============================

New Features
------------

- By default, you will subscribe to all RemoteTracks shared by other Participants in a Room.
  You can now override this behavior through a new ConnectOptions flag `automaticSubscription`.
  Setting it to `false` will make sure that you will not subscribe to any RemoteTrack in a Group or
  Small Group Room. Setting it to `true`, or not setting it at all preserves the default behavior.
  This flag does not have any effect in a Peer-to-Peer Room. (JSDK-2395)

  ```js
    const { connect } = require('twilio-video');
    const room = await connect(token, {
      automaticSubscription: false
    });
  ```

- twilio-video.js will now detect and attempt to recover from media disruptions
  quicker than before thereby improving the performance of the [Network Reconnection API](https://www.twilio.com/docs/video/reconnection-states-and-events). (JSDK-2337)

Bug Fixes
---------

- Fixed a bug where Participants in a Group or Small Group Room stopped receiving
  Dominant Speaker and Network Quality updates when the media server recovered
  from a failover. (JSDK-2307)
- Fixed a bug where, the local and remote AudioTracks' audioLevels returned by
  `Room.getStats()` were not in the range [0-32767]. (JSDK-2303)
- Fixed a bug where Chrome and Safari Participants were enabling simulcast for
  H264 LocalVideoTracks when VP8 simulcast was enabled. (JSDK-2321)

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
  about when they are planning to support the updated JSEP specification. (JSDK-2385)

2.0.0-beta11 (June 12, 2019)
============================

New Features
------------

- By default, twilio-video.js connects to your nearest signaling server, as determined by
  [latency based routing](https://www.twilio.com/docs/video/ip-address-whitelisting#signaling-communication).
  You can now override this behavior by using a new ConnectOptions flag called `region`. This will make
  sure that your signaling traffic will terminate in the specified region. (JSDK-2338)

  ```js
  const { connect } = require('twilio-video');
  const room = await connect(token, {
    region: 'de1'
  });
  ```

  This will guarantee that your signaling traffic will terminate in Germany. For other possible values
  for region, please refer to this [table](https://www.twilio.com/docs/video/ip-address-whitelisting#signaling-communication).
  If you specify an invalid value for `region`, `connect` will raise a [SignalingConnectionError](https://www.twilio.com/docs/api/errors/53000):

  ```js
  const { connect } = require('twilio-video');

  try {
    const room = await connect(token, {
      region: 'foo'
    });
  } catch (error) {
    assert.equal(error.code, 53000);
    assert.equal(error.message, 'Signaling connection error');
  }
  ```

Bug Fixes
---------

- Fixed a bug where Firefox Participants were not able to publish more than one
  LocalDataTrack after joining a Group Room. (JSDK-2274)
- Fixed a bug where Firefox Participants sometimes lost their media connections
  when they tried to publish a LocalDataTrack in a Group Room. (JSDK-2256)

2.0.0-beta10 (June 6, 2019)
===========================

Bug Fixes
---------

- Fixed a bug where Participants on Firefox 68 or above were unable to publish
  LocalAudioTracks or LocalVideoTracks. (JSDK-2381)

2.0.0-beta9 (May 2, 2019)
=========================

New Features
------------

- [Network reconnection](https://www.twilio.com/docs/video/reconnection-states-and-events),
  which was introduced as an opt-in feature in `twilio-video.js@2.0.0-beta6`, is now
  enabled by default. The temporary ConnectOptions flag `_useTwilioConnection` has
  been removed. If this flag is present in ConnectOptions, it will be ignored. (JSDK-2335)

2.0.0-beta8 (April 23, 2019)
============================

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

2.0.0-beta7 (April 1, 2019)
===========================

New Features
------------

- Added VP8 simulcast support for Safari 12.1 and above, which now supports VP8 along
  with H264. You will now be able to play back VP8 VideoTracks from Chrome and Firefox
  Participants in a Group Room. For more details, refer to these guides:
  [Developing for Safari](https://www.twilio.com/docs/video/javascript-v2-developing-safari-11)
  and [Working with VP8 Simulcast](https://www.twilio.com/docs/video/tutorials/working-with-vp8-simulcast). (JSDK-2315)

2.0.0-beta6 (March 15, 2019)
============================

New Features
------------
- [Dominant Speaker](https://www.twilio.com/docs/video/detecting-dominant-speaker)
  and [Network Quality](https://www.twilio.com/docs/video/using-network-quality-api)
  APIs are now generally available.
- twilio-video.js now supports versions of Safari that enable Unified Plan as the
  default SDP format. As of now, Unified Plan is enabled by default in the latest
  Safari Technology Preview. (JSDK-2306)
- Network reconnection is now supported as an opt-in feature. Previously, Participants
  would be disconnected from the Room during network disruptions or handoffs. This
  feature allows Participants to remain connected to the Room.

  To try this new feature in your application **you must perform the following steps**:

  1. Set the Time-To-Live (TTL) of your [AccessToken](https://www.twilio.com/docs/video/tutorials/user-identity-access-tokens)
     to the maximum allowed session duration, currently 14400 seconds (4 hours).
     This ensures that when a network loss occurs the client will be able to
     re-authenticate the reconnection. Note, a reconnection attempt with an expired
     AccessToken will result in an [AccessTokenExpiredError](https://www.twilio.com/docs/api/errors/20104).
  2. Ensure that the [AccessToken]((https://www.twilio.com/docs/video/tutorials/user-identity-access-tokens))
     does not contain a configuration profile sid. Configuration profiles were
     deprecated when we [announced](https://www.twilio.com/blog/2017/04/programmable-video-peer-to-peer-rooms-ga.html#room-based-access-control)
     the general availability of twilio-video.js@1.0.0. Configuration profiles are
     not supported when using this feature.
  3. Enable the feature using the temporary flag `_useTwilioConnection` as follows:

     ```js
     const { connect } = require('twilio-video');
     const room = await connect(token, {
       _useTwilioConnection: true
     });
     ```

  4. The reconnecting event will now raise a [SignalingConnectionDisconnectedError](https://www.twilio.com/docs/api/errors/53001)
     when a signaling connection network disruption occurs. Previously, the reconnecting
     event only raised a [MediaConnectionError](https://www.twilio.com/docs/api/errors/53405).
     You can differentiate between errors in the handler as follows:

     ```js
     room.on('reconnecting', error => {
       if (error.code === 53001) {
         console.log('Reconnecting your signaling connection!', error.message);
       } else if (error.code === 53405) {
         console.log('Reconnecting your media connection!', error.message);
       }
     });
     ```

  5. When a Participant closes the tab/browser or navigates away from your application,
     we recommend that you disconnect from the Room so that other Participants are
     immediately notified. You can achieve this as follows:

     ```js
     window.addEventListener('beforeunload', () => {
       room.disconnect();
     });
     ```

  6. If the reconnect attempt takes too long to complete due to network loss or
     latency issues, then you will be disconnected from the Room with a
     [ParticipantNotFoundError](https://www.twilio.com/docs/api/errors/53204).

  After twilio-video.js@2.0.0 is generally available, we plan to make this an opt-out
  feature in twilio-video.js@2.1.0, followed by removing our existing SIP-based
  signaling transport altogether in twilio-video.js@2.2.0.

Bug Fixes
---------

- Fixed a bug where `Room.getStats` was throwing a TypeError in Electron 3.x. (JSDK-2267)
- Fixed a bug where the LocalParticipant sometimes failed to publish a LocalTrack
  to a group Room due to media negotiation failure. (JSDK-2219)
- Removed workaround for this [Firefox bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1481335)
  on Firefox 65 and above. (JSDK-2280)
- Fixed a bug where passing invalid RTCIceServer urls in ConnectOptions did not
  raise a MediaConnectionError. (JSDK-2279)

2.0.0-beta5 (January 7, 2019)
=============================

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

2.0.0-beta4 (November 29, 2018)
===============================

Bug Fixes
---------

  - Fixed a bug where, when a Safari Participant joins a Room after a Firefox Participant,
    it did not receive video frames for VideoTracks published by the Firefox Participant. (JSDK-2224)

2.0.0-beta3 (November 20, 2018)
===============================

Bug Fixes
---------

- Fixed a bug where unpublishing a LocalTrack from within one of its event
  listeners that have been added before publishing it to the Room throws a
  TypeError. (JSDK-2212)

Note for Electron developers
----------------------------

- twilio-video.js will no longer be usable on Electron 2.x or below. Please
  upgrade to Electron 3.x or higher.

2.0.0-beta2 (October 1, 2018)
=============================

Bug Fixes
---------

- Fixed a bug where calling a LocalVideoTrack's `stop` method did not stop the
  video capture, and thereby did not turn the camera light off. (JSDK-2156)
- Fixed a bug where calling LocalParticipant's `unpublishTrack` on a LocalTrack
  that was being published to a Room also stopped the LocalTrack. (JSDK-2169)

2.0.0-beta1 (August 10, 2018)
=============================

Breaking Changes
----------------

- Google Chrome, starting from version 72, will enable Unified Plan as the default
  SDP format. This version of twilio-video.js will choose Plan B as the SDP format
  in order to continue supporting Google Chrome versions 72 and above until Unified
  Plan support is added. For more details, please refer to this [advisory](https://support.twilio.com/hc/en-us/articles/360012782494-Breaking-Changes-in-Twilio-Video-JavaScript-SDKs-December-2018-).
- RemoteParticipant no longer emits the deprecated "trackAdded" and "trackRemoved"
  events. Use the "trackSubscribed" and "trackUnsubscribed" events instead.
- LocalParticipant no longer contains the deprecated `addTrack`, `addTracks`,
  `removeTrack` and `removeTracks` methods. Use `publishTrack`, `publishTracks`,
  `unpublishTrack`, and `unpublishTracks` instead.
- RemoteTrack no longer has the deprecated `id` property. Use the `sid` or `name`
  properties instead.
- RemoteTrack no longer has the deprecated `isSubscribed` property. Use the
  corresponding RemoteTrackPublication's `isSubscribed` property instead.
- RemoteTrack no longer emits the deprecated "unsubscribed" event. Use the
  corresponding RemoteTrackPublication's "unsubscribed" event instead.
- Participant's `trackPublications` collection is now renamed to `tracks`.
  Similarly, `audioTrackPublications` is now renamed to `audioTracks`,
  `dataTrackPublications` is now renamed to `dataTracks`, and
  `videoTrackPublications` is now renamed to `videoTracks`. Participant no
  longer maintains the deprecated Track-based collections.
- We removed support for Bower.
