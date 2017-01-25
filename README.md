twilio-video.js
===============

[![NPM](https://img.shields.io/npm/v/twilio-video.svg)](https://www.npmjs.com/package/twilio-video) [![Build Status](https://travis-ci.org/twilio/twilio-video.js.svg?branch=master)](https://travis-ci.org/twilio/twilio-video.js)

twilio-video.js allows you to add real-time voice and video to your web apps.

Note that this is a beta release. You may encounter bugs and instability, and
the APIs available in this release may change in subsequent releases.

**We want your feedback!** Email Rob Brazier, Product Manager for Programmable
Video at [rbrazier@twilio.com](mailto:rbrazier@twilio.com) with suggested
improvements, feature requests and general feedback. If you need technical
support, contact [help@twilio.com](mailto:help@twilio.com).

Installation
------------

### NPM

```
npm install twilio-video --save
```

### Bower

Until we release twilio-video.js 1.0.0 proper, you must specify a specific
pre-release. For example,

```
bower install twilio-video#1.0.0-beta4 --save
```

### CDN

Releases of twilio-video.js are hosted on a CDN, and you can include these
directly in your web app using a &lt;script&gt; tag.

```html
<script src="//media.twiliocdn.com/sdk/js/video/v1/twilio-video.min.js"></script>
```

Usage
-----

The following is a simple example showing a Client connecting to a Room. For
more information, refer to the
[API Docs](//media.twiliocdn.com/sdk/js/video/v1/docs).

```js
const Video = require('twilio-video');
const client = new Video.Client('$TOKEN');

client.connect({ to: 'room-name' }).then(room => {
  console.log('Connected to Room "%s"', room.name);

  room.participants.forEach(participant => {
    console.log('Participant "%s" is connected', participant.identity);
    participant.media.attach(document.body);
  });

  room.on('participantConnected', participant => {
    console.log('Participant "%s" connected', participant.identity);
    participant.media.attach(document.body);
  });

  room.on('participantDisconnected', participant => {
    console.log('Participant "%s" disconnected', participant.identity);
  });
});
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
