/**
 * Copyright (c) 2018 uupaa and 2019 Google LLC
 * Licensed under the MIT license.
 *
 * Copied from https://github.com/GoogleChromeLabs/dynamic-import-polyfill
 */

module.exports = (function(scope) {
  const { document, location, Blob, URL } = scope;
  if ([document, location, Blob, URL].some(api => !api)) {
    return function dynamicImportNotSupported(module) {
      return Promise.reject(new Error(`Failed to import: ${module}: dynamicImport is not supported`));
    };
  }
  const cleanupScript = script =>  {
    URL.revokeObjectURL(script.src);
    script.remove();
  };
  scope.__twilioImportedModules = {
    // Imported module map.
  };
  return function dynamicImport(module) {
    return new Promise((resolve, reject) => {
      const absURL = new URL(module, location);
      const moduleBlob = new Blob([
        `import * as m from '${absURL}';`,
        `window.__twilioImportedModules['${absURL}']=m;`
      ], { type: 'text/javascript' });
      const script = Object.assign(document.createElement('script'), {
        type: 'module',
        src: URL.createObjectURL(moduleBlob),
        onerror() {
          cleanupScript(script);
          reject(new Error(`Failed to import: ${absURL}`));
        },
        onload() {
          cleanupScript(script);
          resolve(scope.__twilioImportedModules[absURL]);
        },
      });
      document.head.appendChild(script);
    });
  };
}(globalThis));
