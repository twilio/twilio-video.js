'use strict';

/**
 * Check if a value is strictly not equal to null.
 * @param {*} value
 * returns {boolean}
 */
function isNotNull(value) {
  return value !== null;
}

/**
 * Parse JSON.
 * @param {string}
 * @returns {Object}
 * @throws {Error}
 */
function parseJSON(string) {
  var json = JSON.parse(string);
  return validateObject('Full or Partial Notification', json);
}

/**
 * Parse a string or JSON.
 * @param {String|Object} stringOrJSON
 * @returns {Object}
 * @throws {Error}
 */
function parseStringOrJSON(stringOrJSON) {
  return typeof stringOrJSON === 'object'
    ? stringOrJSON
    : parseJSON(stringOrJSON);
}

/**
 * Validate an instance of a class.
 * @param {*} value
 * @param {*} _class
 * @param {string} name
 * @param {string} className
 * @returns {*}
 * @throws {Error}
 */
function validateInstanceOf(value, _class, name, className) {
  if (!(value instanceof _class)) {
    throw new Error(name + ' is not ' + className + ': ' + value);
  }
  return value;
}

/**
 * Validate an Array.
 * @param {string} name
 * @param {*} value
 * @returns {*}
 * @throws {Error}
 */
function validateArray(name, value) {
  return validateInstanceOf(value, Array, name, 'an array');
}

/**
 * Validate an integer.
 * @param {string} name
 * @param {*} value
 * @returns {*}
 * @throws {Error}
 */
function validateInteger(name, value) {
  if (!Number.isInteger(value)) {
    throw new Error(name + ' is not an integer: ' + value);
  }
  return value;
}

/**
 * Validate an object.
 * @param {string} name
 * @param {*} value
 * @returns {*}
 * @throws {Error}
 */
function validateObject(name, value) {
  return validateInstanceOf(value, Object, name, 'an object');
}

/**
 * Validate a string.
 * @param {string} name
 * @param {*} value
 * @returns {*}
 * @throws {Error}
 */
function validateString(name, value) {
  if (typeof value !== 'string') {
    throw new Error(name + ' is not a string: ' + value);
  }
  return value;
}

/**
 * Run a validation. If it fails, return the default value.
 * @param {function} validation
 * @param {*} def
 * @returns {*}
 */
function validateOr(validation, def) {
  try {
    return validation();
  } catch (error) {
    return def;
  }
}

module.exports.isNotNull = isNotNull;
module.exports.parseJSON = parseJSON;
module.exports.parseStringOrJSON = parseStringOrJSON;
module.exports.validateInstanceOf = validateInstanceOf;
module.exports.validateArray = validateArray;
module.exports.validateInteger = validateInteger;
module.exports.validateObject = validateObject;
module.exports.validateString = validateString;
module.exports.validateOr = validateOr;
