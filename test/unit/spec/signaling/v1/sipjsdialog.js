'use strict';

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var SIPJSDialog = require('../../../../../lib/signaling/v1/sipjsdialog');
var SIPJSMediaHandler = require('../../../../../lib/signaling/v1/sipjsmediahandler');

describe('SIPJSDialog', function() {
  describe('"notification" events', function() {
    var notification = { foo: 'bar' };
    var sipjsDialog;
    var sipjsMediaHandler;

    beforeEach(function() {
      var session = new EventEmitter();
      session.ua = {};
      sipjsMediaHandler = new SIPJSMediaHandler(session);
      session.mediaHandler = sipjsMediaHandler;
      sipjsDialog = new SIPJSDialog({}, '', '', '', new EventEmitter(),
        new EventEmitter(), {}, '', session);
    });

    it('should be queued until an event listener is attached', function(done) {
      sipjsMediaHandler.queue('notification', notification);
      sipjsDialog.on('notification', function(_notification) {
        assert.equal(notification, _notification);
        done();
      });
      sipjsDialog.dequeue('notification');
    });
  });
});
