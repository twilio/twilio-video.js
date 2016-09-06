twilio-video.js
===============

[![NPM](https://img.shields.io/npm/v/twilio-video.svg)](https://www.npmjs.com/package/twilio-video) [![Build Status](https://travis-ci.org/twilio/twilio-video.js.svg?branch=master)](https://travis-ci.org/twilio/twilio-video.js)

twilio-video.js allows you to add multi-party voice and video communications to
your web apps. For more information, see the
[Quickstart and Guides](https://www.twilio.com/docs/api/video).

Including
---------

### CDN

Releases of twilio-video.js are hosted on a CDN, and you can include these
directly in your web app using a &lt;script&gt; tag.

```html
<script src="//media.twiliocdn.com/sdk/js/video/v1/twilio-video.min.js"></script>
```

### NPM & Bower

You can also include twilio-video.js with either [npm](https://www.npmjs.com) or
[bower](http://bower.io/). Including twilio-video.js this way allows you to
integrate flexibly with build systems like [Browserify](http://browserify.org)
and [webpack](https://webpack.github.io).

With npm:

```
npm install twilio-video --save
```

With bower:

```
bower install twilio-video --save
```

Building
--------

Fork and clone the repository. Then, install dependencies with

```
npm install
npm install gulp -g
```

Part of the build process involves running integration tests against Twilio. In
order to run these, you will need a Twilio account and you will need to set
the following environment variables:

* `ACCOUNT_SID`
* `SIGNING_KEY_SID`
* `SIGNING_KEY_SECRET`
* `CONFIGURATION_PROFILE_SID`

Alternatively, you can skip the integration tests by setting `SKIP_INTEGRATION`
to "true". Then, run

```
gulp
```

The builds and docs will be placed in the `dist/` directory.

Contributing
------------

Bug fixes welcome! If you're not familiar with the GitHub pull
request/contribution process,
[this is a nice tutorial](https://gun.io/blog/how-to-github-fork-branch-and-pull-request/).
