'use strict';

var assert = require('assert');
var conversationInfo = require('lib/signaling/conversation-info');

var fullNotification = JSON.stringify({
  "protocol_version": "V1",
  "conversation_state": {
    "instance_version": 6,
    "sid": "CVec396cb3d3171793870a9eaa0d9f81d8",
    "participants": [
      {
        "participant_sid": "PA925933d9c8ec4e85ed0ca83affc4ff82",
        "address": "<sip:roberts@ACe0446c48bd20ab6f6834537a07bedadb.endpoint.twilio.com>;tag=4lugbthfre",
        "tracks": []
      },
      {
        "participant_sid": "PA66d51336199e566d3fa484a977bff17f",
        "address": "<sip:roberts@ACe0446c48bd20ab6f6834537a07bedadb.endpoint.twilio.com;user=p2p-public-sip>",
        "tracks": []
      }
    ]
  },
  "event_list": null
});

var partialNotification = JSON.stringify({
  "protocol_version": "V1",
  "event_list": [
    {
      "event": "PARTICIPANT_CONNECTED",
      "time_stamp": "2015-08-25 01:14:00 AM",
      "participant_sid": "PAb5d9b9a08a6507b59a8ac377516cc164",
      "instance_version": 3,
      "address": "<sip:mark@ACe0446c48bd20ab6f6834537a07bedadb.endpoint.twilio.com>;tag=h1r1nfs80j",
      "tracks": []
    }
  ]
});

describe('Conversation Info', function() {
  describe('.isFullNotification', function() {
    var isFullNotification = conversationInfo.isFullNotification;

    it('should return true for a FullNotification', function() {
      assert(isFullNotification(fullNotification));
    });

    it('should return false for a PartialNotification', function() {
      assert(!isFullNotification(partialNotification));
    });
  });

  describe('.isPartialNotification', function() {
    var isPartialNotification = conversationInfo.isPartialNotification;

    it('should return true for a PartialNotification', function() {
      assert(isPartialNotification(partialNotification));
    });

    it('should return false for a FullNotification', function() {
      assert(!isPartialNotification(fullNotification));
    });
  });

  describe('.parseFullNotification', function() {
    var parseFullNotification = conversationInfo.parseFullNotification;

    it('should parse a FullNotification', function() {
      assert(parseFullNotification(fullNotification));
    });

    it('should fail for a PartialNotification', function() {
      assert.throws(parseFullNotification.bind(null, partialNotification));
    });
  });

  describe('.parseNotification', function() {
    var parseNotification = conversationInfo.parseNotification;

    it('should parse a FullNotification', function() {
      assert(parseNotification(fullNotification));
    });

    it('should parse a PartialNotification', function() {
      assert(parseNotification(partialNotification));
    });
  });

  describe('.parsePartialNotification', function() {
    var parsePartialNotification = conversationInfo.parsePartialNotification;

    it('should parse a FullNotification', function() {
      assert(parsePartialNotification(fullNotification));
    });

    it('should parse a PartialNotification', function() {
      assert(parsePartialNotification(partialNotification));
    });
  });
});
