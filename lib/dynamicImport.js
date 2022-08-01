// typescript has an issue that it compiles await import into require when module is set to commonjs
// https://github.com/microsoft/TypeScript/issues/43329

// To workaround this issue we need following code to be not compiled by typescript.

'use strict';
module.exports = function(module) {
  return import(/* webpackIgnore: true */ module);
};
