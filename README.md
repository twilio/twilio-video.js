twilio-video.js
===============

[![NPM](https://img.shields.io/npm/v/twilio-video.svg)](https://www.npmjs.com/package/twilio-video) [![Build Status](https://travis-ci.org/twilio/twilio-video.js.svg?branch=master)](https://travis-ci.org/twilio/twilio-video.js)

twilio-video.js allows you to add real-time voice and video to your web apps.

* [API Docs](//media.twiliocdn.com/sdk/js/video/v1/docs)
* [Quickstart and Examples](//github.com/twilio/video-quickstart-js)

**We want your feedback!** Email
[video-product@twilio.com](mailto:video-product@twilio.com) with suggested
improvements, feature requests and general feedback, or feel free to open a
GitHub issue. If you need technical support, contact
[help@twilio.com](mailto:help@twilio.com).

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

The following is a simple example showing a Client connecting to a Room. For
more information, refer to the
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

  participant.on('trackAdded', track => trackAdded(div, track));
  participant.tracks.forEach(track => trackAdded(div, track));
  participant.on('trackRemoved', trackRemoved);

  document.body.appendChild(div);
}

function participantDisconnected(participant) {
  console.log('Participant "%s" disconnected', participant.identity);

  participant.tracks.forEach(trackRemoved);
  document.getElementById(participant.sid).remove();
}

function trackAdded(div, track) {
  div.appendChild(track.attach());
}

function trackRemoved(track) {
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
