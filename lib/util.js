/**
 * Require a given module without Browserify attempting to package it for us.
 * @param {string} module - the module to require
 * @returns {Object}
 */
function requireNoBrowserify(module) {
  return eval("require('" + module + "')");
}

module.exports.requireNoBrowserify = requireNoBrowserify;
