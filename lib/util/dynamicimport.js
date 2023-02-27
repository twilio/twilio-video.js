'use strict';

module.exports = (function(scope) {
  const { location, URL } = scope;
  if ([location, URL].some(api => !api)) {
    return function dynamicImportNotSupported(module) {
      return Promise.reject(new Error(`Failed to import: ${module}: dynamicImport is not supported`));
    };
  }
  scope.__twilioVideoImportedModules = {
    // Imported module map.
  };
  return function dynamicImport(module) {
    if (module in scope.__twilioVideoImportedModules) {
      return Promise.resolve(scope.__twilioVideoImportedModules[module]);
    }
    // NOTE(mmalavalli): Calling import() directly can cause build issues in TypeScript and Webpack
    // (and probably other frameworks). So, we create a Function that calls import() in its body.
    // eslint-disable-next-line no-new-func
    return new Function('scope', `return import('${new URL(module, location)}').then(m => scope.__twilioVideoImportedModules['${module}'] = m);`)(scope);
  };
}(globalThis));
