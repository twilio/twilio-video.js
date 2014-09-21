var constants = require('./constants');
var headers = require('./headers');

var decodeBase64 = typeof atob === 'function' ? atob : function(encoded) {
  return new Buffer(encoded, 'base64').toString('ascii');
};

var encodeBase64 = typeof btoa === 'function' ? btoa : function(message) {
  return new Buffer(message).toString('base64');
};

var base64 = {
  decode: decodeBase64,
  encode: encodeBase64
};

function decodeBase64URL(encoded) {
  var remainder = encoded.length % 4;
  if (remainder > 0) {
    var padlen = 4 - remainder;
    encoded += new Array(padlen + 1).join('=');
  }
  encoded = encoded.replace(/-/g, '+')
                   .replace(/_/g, '/');
  return decodeBase64(encoded);
}

var base64URL = {
  decode: memoize(decodeBase64URL)
};

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function fromURLFormEncoded(params) {
  if (params === '') {
    return {};
  }
  var result = {};
  var pairs = params.split('&');
  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i].split('=');
    var key = decodeURIComponent(pair[0]);
    var val = pair[1] ? decodeURIComponent(pair[1]) : null;
    result[key] = val;
  }
  return result;
}

function makeInviteHeaders(info, token, params) {
  var inviteHeaders = [
    headers.X_TWILIO_TOKEN         + ': ' + token.capabilityTokenString,
    headers.X_TWILIO_CLIENT        + ': ' + encodeURIComponent(JSON.stringify(
                                              info)),
    headers.X_TWILIO_CLIENTVERSION + ': ' + constants.CLIENT_VERSION
  ];
  if (params) {
    inviteHeaders.push(headers.X_TWILIO_PARAMS + ': ' + toURLFormEncoded(
                                                          params));
  }
  return inviteHeaders;
}

function makeRegisterHeaders(info, token) {
  var registerHeaders = [
    headers.X_TWILIO_TOKEN         + ': ' + token.capabilityTokenString,
    headers.X_TWILIO_CLIENT        + ': ' + encodeURIComponent(JSON.stringify(
                                              info)),
    headers.X_TWILIO_CLIENTVERSION + ': ' + constants.CLIENT_VERSION
  ];
  return registerHeaders;
}

function makeTarget(appSID) {
  return 'sip:' + appSID + '@' + constants.CHUNDER_HOST;
}

function makeURI(accountSid, clientName) {
  return (clientName || 'Anonymous') +
    '@' + accountSid + '.chunder.twilio.com';
}

function memoize(fn) {
  var memo = {};
  return function() {
    var args = Array.prototype.slice.call(arguments, 0);
    return memo[args] ? memo[args]
                      : memo[args] = fn.apply(null, args);
  };
}

function toURLFormEncoded(dict) {
  var str = '';
  for (var key in dict) {
    str += encodeURIComponent(key) + '=' + encodeURIComponent(dict[key]);
  }
  return str;
}

function parseConnectTarget(_target) {
  var parts = _target.split(':');
  if (parts.length !== 2) {
    throw constants.ERROR_INVALID_CONNECT_TARGET;
  }
  var type = parts[0].toLowerCase();
  var target = {};
  switch (type) {
    case 'twiml':
      target.target = parseAppSID(parts[1]);
      break;
    case 'client':
      target.target = parseClientName(parts[1]);
      break;
    case 'sip':
      target.target = parseSIPURI(parts[1]);
      break;
    case 'tel':
      target.target = parsePhoneNumber(parts[1]);
      break;
    default:
      throw constants.ERROR_INVALID_CONNECT_TARGET;
  }
  target.type = type;
  return target;
}

function parseAppSID(appSID) {
  var parse = appSID.match(/^[a,A][p,P][a-z,A-Z,0-9]{32}$/);
  if (!parse) {
    throw constants.ERROR_INVALID_APP_SID;
  }
  return parse[0];
}

// TODO: Actually parse the client name (i.e. figure out what we support).
function parseClientName(clientName) {
  return clientName;
}

// TODO: Reuse SIP.js's SIP URI parsing facilities.
function parseSIPURI(sipURI) {
  return sipURI;
}

// TODO: Implement E.164 parsing.
function parsePhoneNumber(phoneNumber) {
  return phoneNumber;
}

/**
 * Require a given module without Browserify attempting to package it for us.
 * @param {string} module - the module to require
 * @returns {Object}
 */
function requireNoBrowserify(module) {
  return eval("require('" + module + "')");
}

module.exports.base64 = base64;
module.exports.base64URL = base64URL;
module.exports.deepClone = deepClone;
module.exports.fromURLFormEncoded = fromURLFormEncoded;
module.exports.makeInviteHeaders = makeInviteHeaders;
module.exports.makeRegisterHeaders = makeRegisterHeaders;
module.exports.makeTarget = makeTarget;
module.exports.makeURI = makeURI;
module.exports.parseConnectTarget = parseConnectTarget;
module.exports.toURLFormEncoded = toURLFormEncoded;
module.exports.requireNoBrowserify = requireNoBrowserify;
