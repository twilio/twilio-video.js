twilio-video.js
===============

[![NPM](https://img.shields.io/npm/v/twilio-video.svg)](https://www.npmjs.com/package/twilio-video) [![CircleCI](https://circleci.com/gh/twilio/twilio-video.js/tree/master.svg?style=svg&circle-token=80e91c8284c21ff16d3003702e17b903c0b32f1d)](https://circleci.com/gh/twilio/twilio-video.js/tree/master) [![Windows Build status](https://ci.appveyor.com/api/projects/status/gi5cj6dpfudsqhtg?svg=true)](https://ci.appveyor.com/project/markandrus/twilio-video-js)

For 2.x, go [here](https://github.com/twilio/twilio-video.js/tree/master/).

twilio-video.js allows you to add real-time voice and video to your web apps.

* [API Docs](//media.twiliocdn.com/sdk/js/video/v1/docs)
* [Quickstart and Examples](//github.com/twilio/video-quickstart-js/tree/1.x)
* [Common Issues](https://github.com/twilio/twilio-video.js/blob/master/COMMON_ISSUES.md)

**We want your feedback!** Email
[video-product@twilio.com](mailto:video-product@twilio.com) with suggested
improvements, feature requests and general feedback, or feel free to open a
GitHub issue. If you need technical support, contact
[help@twilio.com](mailto:help@twilio.com).

Browser Support
---------------

|             | Chrome | Edge | Firefox | Safari |
| -----------:|:------ |:---- |:------- |:------ |
| **Android** | ✓      | -    | ✓       | -      |
| **iOS**     | *      | -    | *       | ✓      |
| **Linux**   | ✓      | -    | ✓       | -      |
| **macOS**   | ✓      | -    | ✓       | ✓      |
| **Windows** | ✓      | ✘    | ✓       | -      |

\* Chrome and Firefox for iOS do not have access to WebRTC APIs, unlike Safari
for iOS.

Installation
------------

### NPM

```
npm install twilio-video --save
```

Using this method, you can `require` twilio-video.js like so:

```js
const Video = require('twilio-video');
```

### Bower

```
bower install twilio-video --save
```

### CDN

Releases of twilio-video.js are hosted on a CDN, and you can include these
directly in your web app using a &lt;script&gt; tag.

```html
<script src="//media.twiliocdn.com/sdk/js/video/v1/twilio-video.min.js"></script>
```

Using this method, twilio-video.js will set a browser global:

```js
const Video = Twilio.Video;
```

Usage
-----

The following is a simple example for connecting to a Room. For more information, refer to the
[API Docs](//media.twiliocdn.com/sdk/js/video/v1/docs).

```js
const Video = require('twilio-video');

Video.connect('$TOKEN', { name: 'room-name' }).then(room => {
  console.log('Connected to Room "%s"', room.name);

  room.participants.forEach(participantConnected);
  room.on('participantConnected', participantConnected);

  room.on('participantDisconnected', participantDisconnected);
  room.once('disconnected', error => room.participants.forEach(participantDisconnected));
});

function participantConnected(participant) {
  console.log('Participant "%s" connected', participant.identity);

  const div = document.createElement('div');
  div.id = participant.sid;
  div.innerText = participant.identity;

  participant.on('trackSubscribed', track => trackSubscribed(div, track));
  participant.tracks.forEach(track => trackSubscribed(div, track));
  participant.on('trackUnsubscribed', trackUnsubscribed);

  document.body.appendChild(div);
}

function participantDisconnected(participant) {
  console.log('Participant "%s" disconnected', participant.identity);

  participant.tracks.forEach(trackUnsubscribed);
  document.getElementById(participant.sid).remove();
}

function trackSubscribed(div, track) {
  div.appendChild(track.attach());
}

function trackUnsubscribed(track) {
  track.detach().forEach(element => element.remove());
}
```

Changelog
---------

See [CHANGELOG.md](https://github.com/twilio/twilio-video.js/blob/master/CHANGELOG.md).

License
-------

See [LICENSE.md](https://github.com/twilio/twilio-video.js/blob/master/LICENSE.md).

Building
--------

Fork and clone the repository. Then, install dependencies with

```
npm install
```

Then run the `build` script:

```
npm run build
```

The builds and docs will be placed in the `dist/` directory.

Contributing
------------

Bug fixes welcome! If you're not familiar with the GitHub pull
request/contribution process,
[this is a nice tutorial](https://gun.io/blog/how-to-github-fork-branch-and-pull-request/).
