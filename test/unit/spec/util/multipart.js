'use strict';

var assert = require('assert');
var multipart = require('lib/util/multipart');

var getSDP = multipart.getSDP;
var parse = multipart.parse;

describe('multipart', function() {
  describe('parse(contentType, body)', function() {
    // This test is copied from RFC 5621, Figure 2.
    var sdpBody = '\
v=0\r\n\
o=alice 2890844526 2890842807 IN IP4 atlanta.example.com\r\n\
s=-\r\n\
c=IN IP4 192.0.2.1\r\n\
t=0 0\r\n\
m=audio 20000 RTP/AVP 0\r\n\
a=rtpmap:0 PCMU/8000\r\n\
m=video 20002 RTP/AVP 31\r\n\
a=rtpmap:31 H261/90000\r\n\
\r\n';
    var xmlBody = '\
<?xml version="1.0" encoding="UTF-8"?>\r\n\
<resource-lists xmlns="urn:ietf:params:xml:ns:resource-lists">\r\n\
  <list>\r\n\
    <entry uri="sip:bill@example.com"/>\r\n\
    <entry uri="sip:randy@example.net"/>\r\n\
    <entry uri="sip:joe@example.org"/>\r\n\
  </list>\r\n\
</resource-lists>\r\n';
    var body = '\
--boundary1\r\n\
Content-Type: application/sdp\r\n\
\r\n' +
sdpBody + '\r\n\
--boundary1\r\n\
Content-Type: application/resource-lists+xml\r\n\
Content-Disposition: recipient-list\r\n\
\r\n' +
xmlBody + '\r\n\
--boundary1--\r\n';

    function validateFigure2(parts) {
      assert.equal('application/sdp', parts[0].contentType);
      assert.equal(sdpBody, parts[0].body);
      assert.equal('application/resource-lists+xml', parts[1].contentType);
      assert.equal(xmlBody, parts[1].body);
    }

    var contentTypeTests = [
      [ '"multipart/mixed" message', 'multipart/mixed;boundary="boundary1"' ],
      [ '"multipart/alternative" message', 'multipart/alternative;boundary="boundary1"' ],
      [ '"multipart" message with an unknown subtype', 'multipart/foo;boundary="boundary1"' ]
    ];

    contentTypeTests.forEach(function(test) {
      var name = test[0];
      var contentType = test[1];

      context('parses a ' + name + ' containing two parts', function() {
        var prologue = 'This is a multi-line\r\nprologue\r\n';
        var epilogue = 'This is a multi-line\r\nepilogue\r\n';

        it('when the boundary in the Content-Type is quoted', function() {
          validateFigure2(parse(contentType, body));
        });

        it('when the boundary in the Content-Type is not quoted', function() {
          validateFigure2(parse(contentType.replace(/"/g, ''), body));
        });

        it('when a space leads the boundary in the Content-Type', function() {
          validateFigure2(parse(contentType.replace(';boundary', '; boundary'), body));
        });

        it('when another parameter leads the boundary in the Content-Type', function() {
          validateFigure2(parse(contentType.replace(';boundary', ';foo=bar;boundary'), body));
          validateFigure2(parse(contentType.replace(';boundary', ';foo=bar; boundary'), body));
        });

        it('when another parameter follows the boundary in the Content-Type', function() {
          validateFigure2(parse(contentType.replace('"$', '";foo=bar'), body));
          validateFigure2(parse(contentType.replace('"$', '"; foo=bar'), body));
        });

        it('when a prologue is present', function() {
          validateFigure2(parse(contentType, prologue + body));
        });

        it('when an epilogue is present', function() {
          validateFigure2(parse(contentType, body + epilogue));
        });

        it('when a prologue and epilogue are present', function() {
          validateFigure2(parse(contentType, prologue + body + epilogue));
        });
      });
    });

    it('parses a "multipart" message containing a nested "multipart" message', function() {
      var nestedBody = '\
--boundary1\r\n\
Content-Type: multipart/related; boundary="boundary2"\r\n\
\r\n\
--boundary2\r\n\
Content-Type: text/plain\r\n\
\r\n\
Hello\r\n\
--boundary2\r\n\
Content-Type: text/plain\r\n\
\r\n\
World\r\n\
--boundary2--\r\n\
--boundary1--\r\n';
      var parts = parse('multipart/mixed;boundary="boundary1"', body + nestedBody);
      validateFigure2(parts);

      assert.equal('multipart/related; boundary="boundary2"', parts[2].contentType);
      var nestedParts = parse(parts[2].contentType, parts[2].body);
      assert.equal('text/plain', nestedParts[0].contentType);
      assert.equal('Hello', nestedParts[0].body);
      assert.equal('text/plain', nestedParts[1].contentType);
      assert.equal('World', nestedParts[1].body);
    });

    it('returns an empty array if the Content-Type is not "multipart"', function() {
      assert.equal(0, parse('foo', 'bar').length);
    });

    it('returns an empty array if the boundary parameter is missing', function() {
      assert.equal(0, parse('multipart/mixed', body).length);
    });

    it('returns an empty array on a malformed multipart message', function() {
      assert.equal(0, parse('multipart/mixed;boundary="boundary1"',
        'foo').length);
    });

    it('filters any parts with missing Content-Types', function() {
      assert.equal(1, parse('multipart/mixed;boundary="boundary1"',
        body.replace(/Content-Type: application\/sdp\r\n/, '')).length);
    });
  });

  describe('getSDP(parts)', function() {
    it('returns null if parts is empty', function() {
      var parts = [];
      assert.equal(null, getSDP(parts));
    });
    it('returns the body of the first part with contentType "application/sdp"', function() {
      var parts = [
        { contentType: 'foo', body: 'bar' },
        { contentType: 'application/sdp', body: 'baz' },
        { contentType: 'application/sdp', body: 'corge' }
      ];
      assert.equal('baz', getSDP(parts));
    });
    it('returns the body of the first nested part with contentType "application/sdp"', function() {
      var parts = [
        { contentType: 'foo', body: 'bar' },
        { contentType: 'multipart/mixed;boundary="baz"', body: [
            '--baz',
            'Content-Type: qux',
            '',
            'quux',
            '--baz',
            'Content-Type: application/sdp',
            '',
            'corge',
            '--baz--'
          ].join('\r\n') },
        { contentType: 'application/sdp', body: 'grault' }
      ];
      assert.equal('corge', getSDP(parts));
    });
    it('returns null if no part has contentType "application/sdp"', function() {
      var parts = [
        { contentType: 'foo', body: 'bar' },
        { contentType: 'multipart/mixed;boundary="baz"', body: [
            '--baz',
            'Content-Type: qux',
            '',
            'quux',
            '',
            '--baz--'
          ].join('\r\n') }
      ];
      assert.equal(null, getSDP(parts));
    });
  });
});
