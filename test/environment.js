'use strict';

var Q = require('q');
var prompt = require('promptly').prompt;

/**
 * Returns a promise for an environment variable, {@link name}, by finding it
 * in the environment or prompting the user.
 * @param {string} friendlyName - the variable name to prompt the user with
 * @param {string} name - the name of the environment variable
 * @returns {Promise<string>}
 */
function getVar(friendlyName, name) {
  return name in process.env
    ? Q(process.env[name])
    : Q.nfcall(prompt, friendlyName + ': ');
}

/**
 * Returns a promise for a dictionary of environment variables.
 * @param {Array<Array<string>>} pairs - an array of friendly names and names
 *   (see {@link getVar})
 * @returns {Promise<object>}
 */
function getVars(pairs) {
  var names = pairs.map(function(pair) { return pair[1]; });
  var gotVars = Q([]);
  return pairs.reduce(function(result, pair) {
    return result.then(function(object) {
      var friendlyName = pair[0];
      var name = pair[1];
      return getVar(friendlyName, name).then(function(value) {
        object[name] = value;
        return object;
      });
    });
  }, Q({}));
}

var pairs = [
  ['Account SID',      'ACCOUNT_SID'],
  ['Auth Token',       'AUTH_TOKEN'],
  ['App SID',          'APP_SID'],
  ['API Host',         'API_HOST'],
  ['WebSocket Server', 'WS_SERVER'],
  ['Debug',            'DEBUG']
];

module.exports = getVars(pairs);
