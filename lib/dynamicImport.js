module.exports = function (module) {
  function cleanup(script) {
    URL.revokeObjectURL(script.src);
    script.remove();
  }

  window.__twilioImportedModules = window.__twilioImportedModules || {};

  return new Promise((resolve, reject) => {
    const absURL = new URL(module, window.location);

    if (window.__twilioImportedModules[absURL]) {
      return resolve(window.__twilioImportedModules[absURL]);
    }

    const moduleBlob = new Blob([`import * as m from '${absURL}';`, `window.__twilioImportedModules['${absURL}']=m;`], {
      type: 'text/javascript',
    });

    const script = Object.assign(document.createElement('script'), {
      type: 'module',
      src: URL.createObjectURL(moduleBlob),
      onerror() {
        reject(new Error(`Failed to import: ${url}`));
        cleanup(script);
      },
      onload() {
        resolve(window.__twilioImportedModules[absURL]);
        cleanup(script);
      },
    });

    document.head.appendChild(script);
  });
};