**NEW:** Please check out our [Best Practices Guide](https://www.twilio.com/docs/video/build-js-video-application-recommendations-and-best-practices)
for building video applications with twilio-video.js.

**IMPORTANT:** Please upgrade to the latest version of twilio-video.js to avoid breaking changes in Chrome in early 2020 (removal of Plan B).
See [this advisory](https://support.twilio.com/hc/en-us/articles/360039098974-Upcoming-Breaking-Changes-in-Twilio-Video-JavaScript-SDK-Google-Chrome) for details.

twilio-video.js
===============

[![NPM](https://img.shields.io/npm/v/twilio-video.svg)](https://www.npmjs.com/package/twilio-video) [![CircleCI](https://circleci.com/gh/twilio/twilio-video.js/tree/master.svg?style=svg&circle-token=80e91c8284c21ff16d3003702e17b903c0b32f1d)](https://circleci.com/gh/twilio/twilio-video.js/tree/master) [![Windows Build status](https://ci.appveyor.com/api/projects/status/gi5cj6dpfudsqhtg?svg=true)](https://ci.appveyor.com/project/markandrus/twilio-video-js)

For 1.x, go [here](https://github.com/twilio/twilio-video.js/tree/support-1.x/).

twilio-video.js allows you to add real-time voice and video to your web apps.

* [API Docs](//media.twiliocdn.com/sdk/js/video/latest/docs)
* [Best Practices Guide](https://www.twilio.com/docs/video/build-js-video-application-recommendations-and-best-practices)
* [Common Issues](https://github.com/twilio/twilio-video.js/blob/master/COMMON_ISSUES.md)
* [Quickstart and Examples](//github.com/twilio/video-quickstart-js/tree/master)
* [React-based Multi-party Video App](https://github.com/twilio/twilio-video-app-react)

**We want your feedback!** Email
[video-product@twilio.com](mailto:video-product@twilio.com) with suggested
improvements, feature requests and general feedback, or feel free to open a
GitHub issue. If you need technical support, contact
[help@twilio.com](mailto:help@twilio.com).

Browser Support
---------------

|             | Chrome | Edge (Chromium) | Firefox | Safari |
| ------------|--------|-----------------|---------|--------|
| **Android** | ✓      | -               | ✓       | -      |
| **iOS**     | *      | -               | *       | ✓      |
| **Linux**   | ✓      | -               | ✓       | -      |
| **macOS**   | ✓      | ✓ **            | ✓       | ✓      |
| **Windows** | ✓      | ✓ **            | ✓       | -      |

\* Chrome and Firefox for iOS do not have access to WebRTC APIs, unlike Safari
for iOS.

\*\* twilio-video.js supports the [Chromium-based Edge](https://www.microsoftedgeinsider.com/) browser.

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

### CDN

Releases of twilio-video.js are hosted on a CDN, and you can include these
directly in your web app using a &lt;script&gt; tag.

```html
<script src="//media.twiliocdn.com/sdk/js/video/releases/2.10.0/twilio-video.min.js"></script>

```

Using this method, twilio-video.js will set a browser global:

```js
const Video = Twilio.Video;
```

Usage
-----

The following is a simple example for connecting to a Room. For more information, refer to the
[API Docs](//media.twiliocdn.com/sdk/js/video/latest/docs).

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
  participant.on('trackUnsubscribed', trackUnsubscribed);

  participant.tracks.forEach(publication => {
    if (publication.isSubscribed) {
      trackSubscribed(div, publication.track);
    }
  });

  document.body.appendChild(div);
}

function participantDisconnected(participant) {
  console.log('Participant "%s" disconnected', participant.identity);
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

Content Security Policy (CSP)
-----------------------------

Want to enable [CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) in a
way that's compatible with twilio-video.js? Use the following policy directives:

```
connect-src wss://global.vss.twilio.com wss://sdkgw.us1.twilio.com
media-src mediastream:
```

If you're loading twilio-video.js from [media.twiliocdn.com](https://media.twiliocdn.com),
you should also include the following `script-src` directive:

```
script-src https://media.twiliocdn.com
```

Keep in mind, you may need to merge these policy directives with your own if
you're using other services.

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

Testing
-------

Run unit tests with

```
npm run test:unit
```

Run integration tests with

```
ACCOUNT_SID=<Your account sid> \
API_KEY_SID=<Your api key sid> \
API_KEY_SECRET=<Your api key secret> \
BROWSER=<Browser you'd like to use> \
npm run test:integration
```

You can add these optional variables to control the integration test execution :
- Topology : Decides which type of rooms to test against.
- Debug : To get better source mapping, and the browser does not close after tests are run which allows you to easily step through code to debug.
- Test Files : Allows you to limit the test to just one file.

```
TOPOLOGY=<peer-to-peer|group>
DEBUG=1
TEST_FILES=<path_ to_the_file>
```

Tips
----
- Use Pre-commit hook: We have some useful pre-commit hook that would help identify common mistakes before commit. Use them by executing
```
ln -s ../../pre-commit.sh .git/hooks/pre-commit
```

Contributing
------------

Bug fixes welcome! If you're not familiar with the GitHub pull
request/contribution process,
[this is a nice tutorial](https://gun.io/blog/how-to-github-fork-branch-and-pull-request/).
