twilio-video.js
===============

[![NPM](https://img.shields.io/npm/v/twilio-video.svg)](https://www.npmjs.com/package/twilio-video) [![CircleCI](https://circleci.com/gh/twilio/twilio-video.js/tree/master.svg?style=svg&circle-token=80e91c8284c21ff16d3003702e17b903c0b32f1d)](https://circleci.com/gh/twilio/twilio-video.js/tree/master)

twilio-video.js allows you to add real-time voice and video to your web apps.

* [API Docs](//sdk.twilio.com/js/video/latest/docs)
* [Best Practices Guide](https://www.twilio.com/docs/video/build-js-video-application-recommendations-and-best-practices)
* [Common Issues](https://github.com/twilio/twilio-video.js/blob/master/COMMON_ISSUES.md)
* [Quickstart and Examples](//github.com/twilio/video-quickstart-js/tree/master)
* [React-based Multi-party Video App](https://github.com/twilio/twilio-video-app-react)

**We want your feedback!** Please feel free to open a [GitHub issue](https://github.com/twilio/twilio-video.js/issues) for suggested improvements or feature requests. If you need technical support, contact [help@twilio.com](mailto:help@twilio.com).

Changelog
---------

View [CHANGELOG.md](https://github.com/twilio/twilio-video.js/blob/master/CHANGELOG.md) for details about our releases.

Browser Support
---------------

|             | Chrome | Edge (Chromium) | Firefox | Safari | WebView |
| ------------|--------|-----------------|---------|--------|---------|
| **Android** | ✓      | -               | ✓       | -      | -       |
| **iOS**     | ✓      | -               | *       | ✓      | ✓       |
| **Linux**   | ✓      | -               | ✓       | -      | -       |
| **macOS**   | ✓      | ✓ **            | ✓       | ✓      | -       |
| **Windows** | ✓      | ✓ **            | ✓       | -      | -       |

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

TypeScript definitions can now be imported using this method.

```ts
import * as Video from 'twilio-video';

function participantDisconnected(participant: Video.RemoteParticipant) {
  console.log('Participant "%s" disconnected', participant.identity);
  document.getElementById(participant.sid).remove();
}
```

Alternatively, you can import just the definitions you need like so:

```ts
import { RemoteParticiant } from 'twilio-video';

function participantDisconnected(participant: RemoteParticipant) {
  console.log('Participant "%s" disconnected', participant.identity);
  document.getElementById(participant.sid).remove();
}
```

### CDN

Releases of twilio-video.js are hosted on a CDN, and you can include these
directly in your web app using a &lt;script&gt; tag.

```html
<script src="//sdk.twilio.com/js/video/releases/2.28.1/twilio-video.min.js"></script>
```

Using this method, twilio-video.js will set a browser global:

```js
const Video = Twilio.Video;
```

Usage
-----

The following is a simple example for connecting to a Room. For more information, refer to the
[API Docs](//sdk.twilio.com/js/video/latest/docs).

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

Content Security Policy (CSP)
-----------------------------

Want to enable [CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) in a
way that's compatible with twilio-video.js? Use the following policy directives:

```
connect-src wss://global.vss.twilio.com wss://sdkgw.us1.twilio.com
media-src mediastream:
```

If you're loading twilio-video.js from `sdk.twilio.com`,
you should also include the following `script-src` directive:

```
script-src https://sdk.twilio.com
```

If you are enabling [Krisp Noise Cancellation](https://www.twilio.com/docs/video/noise-cancellation) for
your local audio, and you are using the following `default-src self` directive, you should also add the
`unsafe-eval` directive:

```
default-src self unsafe-eval
```

Keep in mind, you may need to merge these policy directives with your own if
you're using other services.


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

Related
-------
### Applications using twilio-video.js
- [Twilio Video React App](https://github.com/twilio/twilio-video-app-react)
- [Twilio Video Javascript Quickstart](https://github.com/twilio/video-quickstart-js)
- [Twilio Video Diagnostics App](https://github.com/twilio/twilio-video-diagnostics-react-app/blob/main/README.md)

### Developer tools
- [Twilio Video Processors](https://twilio.github.io/twilio-video-processors.js/index.html)
- [Twilio Video Room Monitor](https://github.com/twilio/twilio-video-room-monitor.js)
- [Twilio RTC Diagnostics SDK](https://github.com/twilio/rtc-diagnostics)

Contributing
------------

Bug fixes welcome! If you're not familiar with the GitHub pull
request/contribution process,
[this is a nice tutorial](https://gun.io/blog/how-to-github-fork-branch-and-pull-request/).

License
-------

See [LICENSE.md](https://github.com/twilio/twilio-video.js/blob/master/LICENSE.md).
