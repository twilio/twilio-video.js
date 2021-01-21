'use strict';

const root = document.getElementById('root');

/**
 * Get a {@link Location}'s query parameters.
 * @param {Location} location
 * @returns {Map<string, Array<string>>} queryParameters
 */
function getQueryParameters(location) {
  return (location.search.split('?')[1] || '').split('&').reduce((queryParameters, keyValuePair) => {
    let [key, value] = keyValuePair.split('=');
    key = decodeURIComponent(key);
    value = decodeURIComponent(value);
    queryParameters.set(key, (queryParameters.get(key) || []).concat([value]));
    return queryParameters;
  }, new Map());
}

const token = (getQueryParameters(location).get('token') || [])[0] || '';
const environment = (getQueryParameters(location).get('environment') || [])[0];

// eslint-disable-next-line
console.log('No Framework Environment ', environment, location.search);

Twilio.Video.connect(token, environment ? { environment } : {}).then(room => {
  root.innerHTML = `<p>Connected to Room ${room.sid}.</p>`;
  room.disconnect();
  root.innerHTML = `<p>Disconnected from Room ${room.sid}.</p>`;
}, error => {
  root.innerHTML = `<pre><code>${error.stack} <br> ENVIRONMENT: ${environment}</code></pre>`;
});
