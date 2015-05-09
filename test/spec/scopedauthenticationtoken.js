'use strict';

var assert = require('assert');
var Token = require('../../lib/scopedauthenticationtoken');

describe('ScopedAuthenticationToken', function() {
  describe('a SAT which grants "invite" and "listen" actions', function() {
    var sat = 'eyJjdHkiOiJ0d2lsaW8tc2F0O3Y9MSIsInR5cCI6IkpXVCIsImFsZyI6IkhTMjU2In0.eyJzdWIiOiJBQzk2Y2NjOTA0NzUzYjMzNjRmMjQyMTFlOGQ5NzQ2YTkzIiwiaXNzIjoiU0s5ZWRmOWFjYjNiZDIxZjU0Y2UzNDg5ZTE4YzA5NmJmOSIsImdyYW50cyI6W3sicmVzIjoiaHR0cHM6Ly9hcGkudHdpbGlvLmNvbS8yMDEwLTA0LTAxL0FjY291bnRzL0FDOTZjY2M5MDQ3NTNiMzM2NGYyNDIxMWU4ZDk3NDZhOTMvVG9rZW5zLmpzb24iLCJhY3QiOlsiUE9TVCJdfSx7InJlcyI6InNpcDptYXJrQEFDOTZjY2M5MDQ3NTNiMzM2NGYyNDIxMWU4ZDk3NDZhOTMuZW5kcG9pbnQudHdpbGlvLmNvbSIsImFjdCI6WyJpbnZpdGUiLCJsaXN0ZW4iXX1dLCJleHAiOjE0MzEyMTMwODYuMDIsIm5iZiI6MTQzMTIwNTg4Ni4wMiwianRpIjoiU0s5ZWRmOWFjYjNiZDIxZjU0Y2UzNDg5ZTE4YzA5NmJmOUlRZ0ZveW5LZUtSR1ViV0JsIn0.2mZItSIBBlClDGeh_CxazwfzSqben7cv9ED_Gi0UYqQ';

    it('parses', function() {
      assert(sat = new Token(sat));
    });

    it('should set .accountSid', function() {
      assert(sat.accountSid);
    });

    it('should set .address', function() {
      assert(sat.address);
    });

    it('should set .canInvite', function() {
      assert(sat.canInvite);
    });

    it('should set .canListen', function() {
      assert(sat.canListen);
    });

    it('should set .expires', function() {
      assert(sat.expires instanceof Date);
    });

    it('should set .signingKeySid', function() {
      assert(sat.signingKeySid);
    });
  });

  describe('a SAT which grants "invite" only', function() {
    var sat = 'eyJjdHkiOiJ0d2lsaW8tc2F0O3Y9MSIsInR5cCI6IkpXVCIsImFsZyI6IkhTMjU2In0.eyJzdWIiOiJBQzk2Y2NjOTA0NzUzYjMzNjRmMjQyMTFlOGQ5NzQ2YTkzIiwiaXNzIjoiU0s5ZWRmOWFjYjNiZDIxZjU0Y2UzNDg5ZTE4YzA5NmJmOSIsImdyYW50cyI6W3sicmVzIjoiaHR0cHM6Ly9hcGkudHdpbGlvLmNvbS8yMDEwLTA0LTAxL0FjY291bnRzL0FDOTZjY2M5MDQ3NTNiMzM2NGYyNDIxMWU4ZDk3NDZhOTMvVG9rZW5zLmpzb24iLCJhY3QiOlsiUE9TVCJdfSx7InJlcyI6InNpcDptYXJrQEFDOTZjY2M5MDQ3NTNiMzM2NGYyNDIxMWU4ZDk3NDZhOTMuZW5kcG9pbnQudHdpbGlvLmNvbSIsImFjdCI6WyJpbnZpdGUiXX1dLCJleHAiOjE0MzEyMTMxMzguMjY0LCJuYmYiOjE0MzEyMDU5MzguMjY0LCJqdGkiOiJTSzllZGY5YWNiM2JkMjFmNTRjZTM0ODllMThjMDk2YmY5SVFnRm95bktlS1JHVWJXQmwifQ.sV0VQPegQQkbaExUGZ5LqrP63eItDiBOmk7qmf4DhnY';

    it('parses', function() {
      assert(sat = new Token(sat));
    });

    it('should set .accountSid', function() {
      assert(sat.accountSid);
    });

    it('should set .address', function() {
      assert(sat.address);
    });

    it('should set .canInvite', function() {
      assert(sat.canInvite);
    });

    it('should not set .canListen', function() {
      assert(!sat.canListen);
    });

    it('should set .expires', function() {
      assert(sat.expires instanceof Date);
    });

    it('should set .signingKeySid', function() {
      assert(sat.signingKeySid);
    });
  });

  describe('a SAT which grants "listen" only', function() {
    var sat = 'eyJjdHkiOiJ0d2lsaW8tc2F0O3Y9MSIsInR5cCI6IkpXVCIsImFsZyI6IkhTMjU2In0.eyJzdWIiOiJBQzk2Y2NjOTA0NzUzYjMzNjRmMjQyMTFlOGQ5NzQ2YTkzIiwiaXNzIjoiU0s5ZWRmOWFjYjNiZDIxZjU0Y2UzNDg5ZTE4YzA5NmJmOSIsImdyYW50cyI6W3sicmVzIjoiaHR0cHM6Ly9hcGkudHdpbGlvLmNvbS8yMDEwLTA0LTAxL0FjY291bnRzL0FDOTZjY2M5MDQ3NTNiMzM2NGYyNDIxMWU4ZDk3NDZhOTMvVG9rZW5zLmpzb24iLCJhY3QiOlsiUE9TVCJdfSx7InJlcyI6InNpcDptYXJrQEFDOTZjY2M5MDQ3NTNiMzM2NGYyNDIxMWU4ZDk3NDZhOTMuZW5kcG9pbnQudHdpbGlvLmNvbSIsImFjdCI6WyJsaXN0ZW4iXX1dLCJleHAiOjE0MzEyMTMxNzUuODIyLCJuYmYiOjE0MzEyMDU5NzUuODIyLCJqdGkiOiJTSzllZGY5YWNiM2JkMjFmNTRjZTM0ODllMThjMDk2YmY5SVFnRm95bktlS1JHVWJXQmwifQ.kP0ji-9GVILynBfV-nJegj04BfT_MfZk59h1rOs42Gg';

    it('parses', function() {
      assert(sat = new Token(sat));
    });

    it('should set .accountSid', function() {
      assert(sat.accountSid);
    });

    it('should set .address', function() {
      assert(sat.address);
    });

    it('should not set .canInvite', function() {
      assert(!sat.canInvite);
    });

    it('should set .canListen', function() {
      assert(sat.canListen);
    });

    it('should set .expires', function() {
      assert(sat.expires instanceof Date);
    });

    it('should set .signingKeySid', function() {
      assert(sat.signingKeySid);
    });
  });

  describe('a SAT which grants a SIP resource without actions', function() {
    var sat = 'eyJjdHkiOiJ0d2lsaW8tc2F0O3Y9MSIsInR5cCI6IkpXVCIsImFsZyI6IkhTMjU2In0.eyJzdWIiOiJBQzk2Y2NjOTA0NzUzYjMzNjRmMjQyMTFlOGQ5NzQ2YTkzIiwiaXNzIjoiU0s5ZWRmOWFjYjNiZDIxZjU0Y2UzNDg5ZTE4YzA5NmJmOSIsImdyYW50cyI6W3sicmVzIjoiaHR0cHM6Ly9hcGkudHdpbGlvLmNvbS8yMDEwLTA0LTAxL0FjY291bnRzL0FDOTZjY2M5MDQ3NTNiMzM2NGYyNDIxMWU4ZDk3NDZhOTMvVG9rZW5zLmpzb24iLCJhY3QiOlsiUE9TVCJdfSx7InJlcyI6InNpcDptYXJrQEFDOTZjY2M5MDQ3NTNiMzM2NGYyNDIxMWU4ZDk3NDZhOTMuZW5kcG9pbnQudHdpbGlvLmNvbSIsImFjdCI6W119XSwiZXhwIjoxNDMxMjEzMjA5Ljg5NSwibmJmIjoxNDMxMjA2MDA5Ljg5NSwianRpIjoiU0s5ZWRmOWFjYjNiZDIxZjU0Y2UzNDg5ZTE4YzA5NmJmOUlRZ0ZveW5LZUtSR1ViV0JsIn0.YPyej9HW1AICWV8KM6nh7bnSxf6KyFO67hCtYVJi2JA';

    it('parses', function() {
      assert(sat = new Token(sat));
    });

    it('should set .accountSid', function() {
      assert(sat.accountSid);
    });

    it('should set .address', function() {
      assert(sat.address);
    });

    it('should not set .canInvite', function() {
      assert(!sat.canInvite);
    });

    it('should not set .canListen', function() {
      assert(!sat.canListen);
    });

    it('should set .expires', function() {
      assert(sat.expires instanceof Date);
    });

    it('should set .signingKeySid', function() {
      assert(sat.signingKeySid);
    });
  });

  describe('a SAT which does not include a SIP resource', function() {
    var sat = 'eyJjdHkiOiJ0d2lsaW8tc2F0O3Y9MSIsInR5cCI6IkpXVCIsImFsZyI6IkhTMjU2In0.eyJzdWIiOiJBQzk2Y2NjOTA0NzUzYjMzNjRmMjQyMTFlOGQ5NzQ2YTkzIiwiaXNzIjoiU0s5ZWRmOWFjYjNiZDIxZjU0Y2UzNDg5ZTE4YzA5NmJmOSIsImdyYW50cyI6W3sicmVzIjoiaHR0cHM6Ly9hcGkudHdpbGlvLmNvbS8yMDEwLTA0LTAxL0FjY291bnRzL0FDOTZjY2M5MDQ3NTNiMzM2NGYyNDIxMWU4ZDk3NDZhOTMvVG9rZW5zLmpzb24iLCJhY3QiOlsiUE9TVCJdfV0sImV4cCI6MTQzMTIxMzIzMS4yOTEsIm5iZiI6MTQzMTIwNjAzMS4yOTEsImp0aSI6IlNLOWVkZjlhY2IzYmQyMWY1NGNlMzQ4OWUxOGMwOTZiZjlJUWdGb3luS2VLUkdVYldCbCJ9.fnz8QlVE4cBEmJQxqE_P0FV0352WMjDCVNHGtLFszlc';

    it('parses', function() {
      assert(sat = new Token(sat));
    });

    it('should set .accountSid', function() {
      assert(sat.accountSid);
    });

    it('should not set .address', function() {
      assert(!sat.address);
    });

    it('should not set .canInvite', function() {
      assert(!sat.canInvite);
    });

    it('should not set .canListen', function() {
      assert(!sat.canListen);
    });

    it('should set .expires', function() {
      assert(sat.expires instanceof Date);
    });

    it('should set .signingKeySid', function() {
      assert(sat.signingKeySid);
    });
  });

  describe('an invalid SAT', function() {
    it('does not parse', function() {
      assert.throws(Token.bind(null, 'foobar'));
    });
  });
});
