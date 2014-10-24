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
`./dist/twilio-simple-signaling.${VERSION}.js.map`.

`gulp build` also builds the twilio.js 1.2 adapter (see below).

### twilio.js 1.2 Adapter

This project also includes a twilio.js 1.2 compatible wrapper around the new
`Peer` and `Call` objects. To build this separately, run

```
$ gulp build-adapter
```

Testing
-------

Unit and functional tests are defined in

- `./test/unit/`
- `./test/functional/`

Unit tests can be run with

```
$ gulp unit-test
```

While functional tests can be run with

```
$ gulp functional-test
```

To run both unit and functional tests, use

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
