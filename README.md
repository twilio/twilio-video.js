Twilio Simple Signaling
=======================

This is the development repository for twilio-simple-signaling.

[Click here to review the API.](//simple-signaling.appspot.com/)

This project is based around [gulp](//gulpjs.com/). As such, there are a number
of tasks you may wish to run. But first, make sure you've installed everything.

Clone this repo, and then, from the project directory, run

```
$ npm install -g gulp
$ npm install
```

Now, you can run `gulp` to automatically

- Clean
- Run functional and unit tests
- Lint using [JSHint](//github.com/jshint/jshint/)
- Generate [JSDoc](//usejsdoc.org/) documentation
- Build using [Browserify](http://browserify.org/) and [UglifyJS](https://github.com/mishoo/UglifyJS2), as well as generate [source maps](//docs.google.com/a/twilio.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k)

Building
--------

Run the following to build `./dist/twilio-simple-signaling.${VERSION}.js`.
`${VERSION}` is read from `./package.json`.

```
$ gulp build
```

The resulting file is minified and paired with a source map,
`./dist/twilio-signal.${VERSION}.js.map`.

Testing
-------

Unit and integration tests are defined in

- `./test/unit/`
- `./test/integration/`

Unit tests can be run with

```
$ gulp unit-test
```

While integration tests can be run with

```
$ gulp integration-test
```

To run both unit and integration tests, use

```
$ gulp test
```

Docs
----

You can generate docs using

```
$ gulp doc
```

And you can publish these to [simple-signaling.appspot.com](//simple-signaling.appspot.com)
with

```
$ gulp publish-doc
```

Linting
-------

Try to follow the linter's advice. If you find a well-understood pattern that
proves to be useful but is rejected by the linter, add it to the list of
exceptions.

You can lint using

```
$ gulp lint
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
    _foo: {
      value: 'foo'
    },
    _bar: {
      get: function() {
        return bar;
      },
      set: function(_bar) {
        bar = _bar;
      }
    },
    // Public
    bar: {
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

Notice how "private" variables are prefixed with an underscore. Additionally,
the use of getters and setters on the private variable `_bar` but only a getter
on `bar` allows us to control who can modify `bar`.
