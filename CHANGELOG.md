For 1.x changes, go [here](https://github.com/twilio/twilio-video.js/blob/support-1.x/CHANGELOG.md).

2.0.0 (In Progress)
===================

Twilio Video Javascript SDK 2.0 is now GA! Thank you to all our beta users and for all the feedback you sent us during the beta period.

Twilio Video Javascript SDK 2.0 introduces the [Track Priority](https://www.twilio.com/docs/video/tutorials/using-track-priority-api) API, [Network Bandwidth Profile](https://www.twilio.com/docs/video/tutorials/using-bandwidth-profile-api) API, [Reconnection States and Events](https://www.twilio.com/docs/video/reconnection-states-and-events), and the [Region Selection](https://www.twilio.com/docs/video/tutorials/video-regions-and-global-low-latency) API.

[Track Priority](https://www.twilio.com/docs/video/tutorials/using-track-priority-api) and [Network Bandwidth Profile](https://www.twilio.com/docs/video/tutorials/using-bandwidth-profile-api) API gives developers the ability to specify how bandwidth should be allocated between the video tracks. Furthermore, the three profiles, (“grid”, “collaboration”, and “presentation”), specify when tracks should be switched off (or not) to conserve bandwidth for the highest priority tracks.

The [Reconnection States and Events](https://www.twilio.com/docs/video/reconnection-states-and-events) will automatically attempt to reconnect when a transient network error is encountered.

With [Region Selection](https://www.twilio.com/docs/video/tutorials/video-regions-and-global-low-latency) API, the SDK will automatically connect to the lowest latency data center. This API can also be configured to connect to a specific data center for cases where compliance might be required.

If migrating from a 1.x version, please refer to our [migration guide](https://www.twilio.com/docs/video/migrating-1x-2x).


To get started with Twilio Video JS, check our [Getting Started Guide](https://www.twilio.com/docs/video/javascript-v2-getting-started)

