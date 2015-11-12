'use strict';

var validation = require('../util/validation');

/**
 * JSON conformant to the application/rtc-auth-info+json content-type.
 * @typedef RTCAuthInfo
 * @type {object}
 * @property {RTCAuthInfoConfig} config
 * @property {?Array<RTCAuthInfoWarning>} warnings
 */

/**
 * {@link RTCAuthInfo} includes configuration in the form of
 * {@link RTCAuthInfoConfig}
 * @typedef RTCAuthInfoConfig
 * @type {object}
 */

/**
 * {@link RTCAuthInfo} includes warnings in the event that something went
 * wrong when fetching the {@link RTCAuthInfoConfiguration}. These warnings
 * come in the form of {@link RTCAuthInfoWarning}s.
 * @typedef RTCAuthInfoWarning
 * @type {object}
 * @property {string} message
 * @property {number} code
 */

/**
 * Parse {@link RTCAuthInfo}.
 * @param {string|Object} notification
 * @returns {FullNotification|PartialNotification}
 * @throws {Error}
 */
function parseRTCAuthInfo(stringOrJSON) {
  var rtcAuthInfo = validation.parseStringOrJSON(stringOrJSON);

  /* eslint dot-notation:0 */
  var config = validateRTCAuthInfoConfig(rtcAuthInfo['config']);
  var warnings = validateRTCAuthInfoWarnings(rtcAuthInfo['warnings']);

  var validated = {
    config: config
  };

  if (warnings.length) {
    validated.warnings = warnings;
  }

  return validated;
}

/**
 * Validate {@link RTCAuthInfoConfig} or return null.
 * @param {*} config
 * @returns {?RTCAuthInfoConfig}
 * @throws {Error}
 */
function validateRTCAuthInfoConfig(config) {
  return validation.validateObject('Config', config);
}

/**
 * Validate {@link RTCAuthInfoWarning}s. Invalid {@link RTCAuthInfoWarning}s will be
 * filtered.
 * @param {*} warnings
 * @returns {?Array<RTCAuthInfoWarning>}
 */
function validateRTCAuthInfoWarnings(warnings) {
  return validation.validateOr(validation.validateArray.bind(null, 'Warnings', warnings), [])
    .map(validateRTCAuthInfoWarningOrNull)
    .filter(validation.isNotNull);
}

/**
 * Validate an {@link RTCAuthInfoWarning}.
 * @param {*} warning
 * @returns {RTCAuthInfoWarning}
 * @throws {Error}
 */
function validateRTCAuthInfoWarning(warning) {
  validation.validateObject('Warning', warning);
  /* eslint dot-notation:0 */
  validation.validateString('Warning message', warning['message']);
  var validated = {
    message: warning['message']
  };
  if ('code' in warning) {
    validation.validateInteger('Warning code', warning['code']);
    validated.code = warning['code'];
  }
  return validated;
}

function validateRTCAuthInfoWarningOrNull(warning) {
  return validation.validateOr(validateRTCAuthInfoWarning.bind(null, warning), null);
}

module.exports.parseRTCAuthInfo = parseRTCAuthInfo;
