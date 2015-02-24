Signal
======

This is the development repository for the Signal JavaScript library. You must have the following installed to build and test this project:

- [Node](http://nodejs.org/)
- Python [`virtualenv`](http://docs.python-guide.org/en/latest/dev/virtualenvs/) 
- [Google App Engine Python SDK](https://storage.googleapis.com/appengine-sdks/featured/GoogleAppEngineLauncher-1.9.17.dmg)
- `www/twilio_credentials.json` (see the included example file)

Try the demo at [simple-signaling.appspot.com](http://simple-signaling.appspot.com), or read the docs at [simple-signaling.appspot.com/doc](http://simple-signaling.appspot.com/doc).

Building
--------

Run `make` to build `dist/twilio-signal.${VERSION}.js`. `${VERSION}` is read from `package.json`.

```
$ make
```

Testing
-------

### Demo Application

A demo application is included in `www` that allows you to place peer-to-peer calls. You can run it locally at [localhost:8080](http://localhost:8080) with

```
$ make serve
```

This will prompt you to setup a `www/twilio_credentials.json` file including account SIDs and authentication tokens. This file should _not_ be checked into this repository.

This application also lives at [simple-signaling.appspot.com](http://simple-signaling.appspot.com). Once you have confirmed your changes work, you can push to Google App Engine with

```
$ make publish
```

### Unit & Integration Tests

Unit and integration tests use [Mocha](http://mochajs.org/) and are defined in

- `test/unit/`
- `test/integration/`

You can run both with

```
$ make test
```

Or, if you have [gulp](http://gulpjs.com/) installed, run

```
$ gulp unit-test
$ gulp integration-test
```

Documentation
-------------

Documentation is generated using [JSDoc](http://usejsdoc.org/). You can generate documentation with

```
$ make doc
```

Linting
-------

Linting is provided by [JSHint](https://github.com/jshint/jshint/). Try to follow the linter's advice. If you find a well-understood pattern that proves to be useful but is rejected by the linter, add it to the list of exceptions.

You can lint using

```
$ make lint
```

Contributing
------------

Classes should be formatted as follows:

```javascript
'use strict';  // All files should be strict-mode.

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

function MyClass(param1, param2) {
  // Unless your class can also be used as a mixin, we want to guard against
  // accidental invocations without the `new` operator.
  if (!(this instanceof MyClass)) {
    return new MyClass(param1, param2);
  }

  // Optionally inherit from EventEmitter.
  EventEmitter.call(this);

  var bar = 'bar';

  Object.defineProperties(this, {
    // Private
    '_foo': {
      value: 'foo'
    },
    '_bar': {
      get: function() {
        return bar;
      },
      set: function(_bar) {
        bar = _bar;
      }
    },
    // Public
    'bar': {
      get: function() {
        return bar;
      }
    }
  });

  return Object.freeze(this);
}

// Optionally inherit from EventEmitter (or some other class).
inherits(MyClass, EventEmitter);

MyClass.someClassMethod = function someClassMethod() {
  // Do something.
};

MyClass.prototype.someInstanceMethod = function someInstanceMethod() {
  // Do something, preferrably returning `this` to support fluent-style.
  return this;
};

module.exports = MyClass;
```

Notice how "private" variables are prefixed with an underscore. Additionally, the use of getters and setters on the private variable `_bar` but only a getter on `bar` allows us to control who can modify `bar`.
