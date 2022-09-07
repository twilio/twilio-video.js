/**
 * Copyright (c) 2018 uupaa and 2019 Google LLC
 * Licensed under the MIT license.
 *
 * Copied from https://github.com/GoogleChromeLabs/dynamic-import-polyfill
 */
module.exports = (function (scope) {
    var document = scope.document, location = scope.location, Blob = scope.Blob, URL = scope.URL;
    if ([document, location, Blob, URL].some(function (api) { return !api; })) {
        return function dynamicImportNotSupported(module) {
            return Promise.reject(new Error("Failed to import: " + module + ": dynamicImport is not supported"));
        };
    }
    var cleanupScript = function (script) {
        URL.revokeObjectURL(script.src);
        script.remove();
    };
    scope.__twilioImportedModules = {
    // Imported module map.
    };
    return function dynamicImport(module) {
        return new Promise(function (resolve, reject) {
            var absURL = new URL(module, location);
            var moduleBlob = new Blob([
                "import * as m from '" + absURL + "';",
                "window.__twilioImportedModules['" + absURL + "']=m;"
            ], { type: 'text/javascript' });
            var script = Object.assign(document.createElement('script'), {
                type: 'module',
                src: URL.createObjectURL(moduleBlob),
                onerror: function () {
                    cleanupScript(script);
                    reject(new Error("Failed to import: " + absURL));
                },
                onload: function () {
                    cleanupScript(script);
                    resolve(scope.__twilioImportedModules[absURL]);
                },
            });
            document.head.appendChild(script);
        });
    };
}(globalThis));
//# sourceMappingURL=dynamicimport.js.map