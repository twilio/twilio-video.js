var Q = require('q');

function request(method, params) {
  var deferred = Q.defer();

  if (typeof XMLHttpRequest === 'undefined') {
    setTimeout(deferred.reject);
    return deferred.promise;
  }

  var xhr = new XMLHttpRequest();

  xhr.open(method, params.url, true);
  xhr.onreadystatechange = function onreadystatechange() {
    if (xhr.readyState !== 4) { return; }

    if (xhr.status === 200) {
      deferred.resolve(xhr.response);
    } else {
      deferred.reject(xhr.response);
    }
  };

  for(var headerName in params.headers) {
    xhr.setRequestHeader(headerName, params.headers[headerName]);
  }

  xhr.send(JSON.stringify(params.body));

  return deferred.promise;
}

/**
 * Use XMLHttpRequest to get a network resource.
 * @param {String} method - HTTP Method
 * @param {Object} params - Request parameters
 * @param {String} params.url - URL of the resource
 * @param {Array}  params.headers - An array of headers to pass [{ headerName : headerBody }]
 * @param {Object} params.body - A JSON body to send to the resource
 * @returns {Promise}
 **/
var Request = request;

/**
 * Sugar function for request('GET', params);
 * @param {Object} params - Request parameters
 * @returns {Promise}
 */
Request.get = function(params) {
  return request('GET', params);
}

/**
 * Sugar function for request('POST', params);
 * @param {Object} params - Request parameters
 * @returns {Promise}
 */
Request.post = function(params) {
  return request('POST', params);
}

module.exports = Request;
