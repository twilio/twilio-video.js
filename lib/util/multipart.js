'use strict';

/**
 * Get a parameter from a Content-Type.
 * @param {string} contentType - the Content-Type
 * @param {string} attribute - the attribute to get
 * @returns {?string}
 */
function getContentTypeParameter(contentType, _attribute) {
  var parameters = contentType.split(';').slice(1);
  for (var i = 0; i < parameters.length; i++) {
    var parameter = parameters[i];

    var indexOfEqual = parameter.indexOf('=');
    if (indexOfEqual === -1) {
      continue;
    }

    var attribute = parameter
      .slice(0, indexOfEqual)
      .replace(/^ */, '')
      .replace(/ *$/, '');
    if (attribute !== _attribute) {
      continue;
    }

    var value = parameter
      .slice(indexOfEqual + 1)
      .replace(/^ */, '')
      .replace(/ *$/, '');

    var escaped = value.match(/^"(.*)"$/);
    if (escaped) {
      return escaped[1].replace(/\\"/, '"');
    }
    return value;
  }
  return null;
}

/**
 * Parse a multipart message.
 * @param {string} contentType
 * @param {string} body
 * @returns {Array<Part>}
 */
function parse(contentType, body) {
  var boundary = getContentTypeParameter(contentType, 'boundary');
  if (!boundary) {
    return [];
  }

  var delimeter = '\r\n--' + boundary;
  var parts = ('\r\n' + body).split(delimeter);

  // Ignore the prologue and epilogue.
  parts = parts.slice(1, parts.length - 1);

  var parsed = [];
  parts.forEach(function(part) {
    var match = part.match(/\r\nContent-Type: (.*)\r\n/);
    if (!match) {
      return;
    }

    var contentType = match[1]
      .replace(/^ */, '')
      .replace(/ *$/, '');

    var startOfBody = part.indexOf('\r\n\r\n');
    if (startOfBody === -1) {
      return;
    }

    var body = part.slice(startOfBody + 4);
    parsed.push({
      contentType: contentType,
      body: body
    });
  });
  return parsed;
}

/**
 * Get the body of the first part matching the Content-Type.
 * @param {string} contentType
 * @param {Array<Part>} parts
 * @returns {?string}
 */
function getPart(contentType, parts) {
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    if (part.contentType === contentType) {
      return part.body;
    } else if (/^multipart\//.test(part.contentType)) {
      var sdp = getPart(contentType, parse(part.contentType, part.body));
      if (sdp) {
        return sdp;
      }
    }
  }
  return null;
}

/**
 * Get the first Conversation Info, if any, out of a "multipart" body.
 * @param {Array<Part>} parts
 * @returns {?string}
 */
var getConversationInfo = getPart.bind(null, 'application/conversation-info+json');

/**
 * Get the first SDP, if any, out of a "multipart" body.
 * @param {Array<Part>} parts
 * @returns {?string}
 */
var getSDP = getPart.bind(null, 'application/sdp');

/**
 * A single part in a multipart message.
 * @typedef {object} Part
 * @property {string} contentType - the Content-Type of the part
 * @property {string} body - the part's body
 */

module.exports.getConversationInfo = getConversationInfo;
module.exports.getSDP = getSDP;
module.exports.parse = parse;
