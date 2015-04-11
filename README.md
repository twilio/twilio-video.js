twilio-conversations.js
=======================

This is the development repository for next-generation Twilio JavaScript library. You must have [Node](//nodejs.org) installed to test and build this project.

Try the demo at [simple-signaling.appspot.com](http://simple-signaling.appspot.com).

Building
--------

Lint, test, and build the library by running

```
$ make
```

Testing
-------

The [source code for simple-signaling.appspot.com](//code.hq.twilio.com/client/simple-signaling.appspot.com) is included as a git submodule of this repository, allowing you to test builds locally at [localhost:8080](http://localhost:8080) by running

```
$ make serve
```

For more information, refer to the [client/simple-signaling.appspot.com] repository.

### Specifications

Specifications use [Mocha](http://mochajs.org/) and are defined in `test/spec`. You can run these with

```
$ make test
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
