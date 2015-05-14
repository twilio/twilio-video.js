'use strict';

var assert = require('assert');
var Q = require('q');
var util = require('../../lib/util');
var iceServers = require('../../test')['iceServers'];

function test() {
  describe('util', function() {
    it('getStunServers', function() {
      assert(util.getStunServers(iceServers));
    });

    it('getTurnServers', function() {
      assert(util.getTurnServers(iceServers));
    });

    describe('parseConversationSIDFromContactHeader', function() {
      var conversationSid = 'CV123';

      it('should parse contact headers with display names', function() {
        var contactHeader = '"fud" <sip:CV123@172.18.8.202:443;transport=wss>';
        assert.equal(conversationSid,
          util.parseConversationSIDFromContactHeader(contactHeader));
      });

      it('should parse contact headers without display names', function() {
        var contactHeader = '<sip:CV123@172.18.8.202:443;transport=wss>';
        assert.equal(conversationSid,
          util.parseConversationSIDFromContactHeader(contactHeader));
      });
    });

    describe('parseUserAgent', function() {
      var matchesUA = function(uaString, name, version) {
        var spec = util.parseUserAgent(uaString);
        return spec.name === name && spec.version === version;
      };

      it('returns the correct object for a Chrome user agent', function() {
        var spec = util.parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36');
        assert.equal(spec.name, 'Chrome');
        assert.equal(spec.version, '42.0');
      });

      it('returns the correct object for a Firefox user agent', function() {
        var spec = util.parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:38.0) Gecko/20100101 Firefox/38.0');
        assert.equal(spec.name, 'Firefox');
        assert.equal(spec.version, '38.0');
      });

      it('returns the correct object for a Safari user agent', function() {
        var spec = util.parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/600.5.17 (KHTML, like Gecko) Version/8.0.5 Safari/600.5.17');
        assert.equal(spec.name, 'Safari');
        assert.equal(spec.version, '600.5');
      });

      it('returns the correct object for an Opera user agent', function() {
        var spec = util.parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.90 Safari/537.36 OPR/29.0.1795.47');
        assert.equal(spec.name, 'Opera');
        assert.equal(spec.version, '29.0');
      });

      it('returns the correct object for a newer IE user agent', function() {
        var spec = util.parseUserAgent('Mozilla/5.0 (compatible, MSIE 11, Windows NT 6.3; Trident/7.0; rv:11.0) like Gecko');
        assert.equal(spec.name, 'IE');
        assert.equal(spec.version, '11.0');
      });

      it('returns the correct object for an older IE user agent', function() {
        var spec = util.parseUserAgent('Mozilla/5.0 (compatible; MSIE 7.0; Windows NT 6.0; en-US)');
        assert.equal(spec.name, 'IE');
        assert.equal(spec.version, '7.0');
      });
    });
  });
}

function waitAll(promisesOrDeferreds, done) {
  promisesOrDeferreds = promisesOrDeferreds.map(function(pOrD) {
    return pOrD.promise ? pOrD.promise : pOrD;
  });
  return Q.all(promisesOrDeferreds).then(function() {
    done();
  }, done);
}

module.exports.test = test;
module.exports.waitAll = waitAll;
