'use strict';

const XHR = require('xmlhttprequest').XMLHttpRequest;

/**
 * Make a network request.
 * @param {String} method - HTTP method to use. e.g: GET, POST.
 * @param {RequestParams} params
 * @returns {Promise<String>} responseText
*//**
 * @typedef {Object} RequestParams
 * @property {String} url - URL to access.
 * @property {Object} [headers] - An unformatted map of headers.
 * @property {Object} [body] - An unformatted map representing
 *   post body.
 * @property {Boolean} [withCredentials=false] - Whether to set the
 *   XHR withCredentials flag.
 */
function request(method, params) {
  return new Promise((resolve, reject) => {
    if (typeof method !== 'string' || !params) {
      throw new Error('<String>method and <Object>params are required args.');
    }

    const xhr = new XHR();
    xhr.open(method.toUpperCase(), params.url, true);
    xhr.withCredentials = !!params.withCredentials;

    xhr.onreadystatechange = function onreadystatechange() {
      if (xhr.readyState !== 4) { return; }

      if (200 <= xhr.status && xhr.status < 300) {
        resolve(xhr.responseText);
      } else {
        reject(xhr.responseText);
      }
    };

    for (const headerName in params.headers) {
      xhr.setRequestHeader(headerName, params.headers[headerName]);
    }

    xhr.send(params.body);
  });
}

request.get = request.bind(null, 'GET');
request.post = request.bind(null, 'POST');

module.exports = request;
