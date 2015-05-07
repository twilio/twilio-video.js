'use strict';

var constants = require('./util/constants');
var E = constants.twilioErrors;
var util = require('./util');

/**
 * Parses a JWT to a {@link Token}.
 *
 * @classdesc A {@link Token} wraps a JSON Web Token (JWT)
 * representing call capabilities (e.g. the ability to make incoming
 * or outgoing calls).
 *
 * @constructor
 *
 * @param {string} capabilityTokenString - The capability token string to
 *                                         parse
 *
 * @property {string}  accountSid            - The account SID
 * @property {string}  capabilityTokenString - The original, unparsed
 *                                             capability token string
 * @property {?string} incomingClientName    - The incoming client name, if any
 * @property {?string} outgoingAppSid        - The outgoing application SID, if
 *                                             any
 * @property {?string} outgoingClientName    - The outgoing client name, if any
 * @property {?Object} outgoingParameters    - The outgoing application
 *                                             parameters, if any
 * @property {boolean} supportsIncoming      - Whether or not the capability
 *                                             token allows incoming calls
 * @property {boolean} supportsOutgoing      - Whether or not the capability
 *                                             token allows outgoing calls
 *
 * @throws Capability token string has the wrong number of segments
 * @throws Capability token contains an invalid scope URI
 * @throws Outgoing capability token must specify an app SID
 * @throws Incoming capability token must specify a client name
 * @throws Capability token supports neither incoming nor outgoing calls
 * @throws Invalid application SID
 */
function Token(capabilityTokenString) {
  if (capabilityTokenString instanceof Token) {
    return capabilityTokenString;
  } else if (!(this instanceof Token)) {
    return new Token(capabilityTokenString);
  }

  var payload = parsePayload(capabilityTokenString);
  var accountSid = payload.iss;
  var privileges = 'client' in payload.scopes ? payload.scopes.client : {};

  // TODO: Support multiple outgoing capabilities.
  var supportsOutgoing = 'outgoing' in privileges;
  var outgoingParameters = supportsOutgoing
                         ? privileges.outgoing[0]
                         : null;
  var outgoingAppSid = outgoingParameters
                     ? outgoingParameters.appSid || null
                     : null;
  if (outgoingParameters && 'appParams' in outgoingParameters) {
    outgoingParameters =
      util.fromURLFormEncoded(outgoingParameters.appParams);
  }
  if (supportsOutgoing && !outgoingAppSid) {
    throw 'Outgoing tokens require an appSid';
  }
  var outgoingClientName = outgoingParameters
                         ? outgoingParameters.clientName || null
                         : null;
  if (outgoingParameters) {
    delete outgoingParameters.appSid;
    delete outgoingParameters.clientName;
  }

  // TODO: Support multiple incoming capabilities.
  var supportsIncoming = 'incoming' in privileges;
  var incomingParams = supportsIncoming
                     ? privileges.incoming[0]
                     : null;
  var incomingClientName = incomingParams
                         ? incomingParams.clientName
                         : null;
  if (supportsIncoming && !incomingClientName) {
    throw 'Incoming tokens require a clientName';
  }

  Object.defineProperties(this, {
    'accountSid': {
      value: accountSid
    },
    'capabilityTokenString': {
      value: capabilityTokenString
    },
    'incomingClientName': {
      value: incomingClientName
    },
    'outgoingAppSid': {
      value: outgoingAppSid
    },
    'outgoingClientName': {
      value: outgoingClientName
    },
    'outgoingParameters': {
      value: outgoingParameters
    },
    'supportsIncoming': {
      value: supportsIncoming
    },
    'supportsOutgoing': {
      value: supportsOutgoing
    },
  });

  return this;
}

module.exports = Token;

/**
 * Parse a JWT's payload.
 *
 * @ignore
 *
 * @param {string} jwt - The JWT
 *
 * @throws Capability token string has the wrong number of segments
 * @throws Capability token contains an invalid scope URI
 *
 * @return {Object}
 */
function parsePayload(jwt) {
  var segs = jwt.split('.');
  if (segs.length !== 3) {
    throw 'Token is invalid or malformed';
  }
  var encodedPayload = segs[1];
  var payload = JSON.parse(util.base64URL.decode(encodedPayload));
  payload.scopes = parseScopes(payload);
  delete payload.scope;
  return payload;
}

/**
 * Parse scope URIs.
 *
 * @ignore
 *
 * @param {Object} payload - The JWT payload
 *
 * @throws Capability token contains an invalid scope URI
 *
 * @returns {Object}
 */
function parseScopes(payload) {
  var scopes = payload.scope.length === 0 ? [] : payload.scope.split(' ');
  var parsedScopes = {};
  for (var i = 0; i < scopes.length; i++) {
    var scope = parseScope(scopes[i]);
    var service = parsedScopes[scope.service]
                = parsedScopes[scope.service] || {};
    var privilege = service[scope.privilege] = service[scope.privilege] || [];
    privilege.push(scope.params);
  }
  return parsedScopes;
}

/**
 * Parse a scope URI.
 *
 * @ignore
 *
 * @param {string} uri - A scope URI
 *
 * @throws Capability token contains an invalid scope URI
 *
 * @returns {Object}
 */
function parseScope(uri) {
    var parts = uri.match(/^scope:(\w+):(\w+)\??(.*)$/);
    if (!(parts && parts.length === 4)) {
      throw 'Scope URI is invalid or malformed';
    }
    return {
        service: parts[1],
        privilege: parts[2],
        params: util.fromURLFormEncoded(parts[3])
    };
}
