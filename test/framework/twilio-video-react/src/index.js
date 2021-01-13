import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';

/**
 * Get a {@link Location}'s query parameters.
 * @param {Location} location
 * @returns {Map<string, Array<string>>} queryParameters
 */
function getQueryParameters(location) {
  return (location.search.split('?')[1] || '').split('&').reduce((queryParameters, keyValuePair) => {
    var [key, value] = keyValuePair.split('=');
    key = decodeURIComponent(key);
    value = decodeURIComponent(value);
    queryParameters.set(key, (queryParameters.get(key) || []).concat([value]));
    return queryParameters;
  }, new Map());
}

// eslint-disable-next-line
const token = (getQueryParameters(location).get('token') || [])[0] || '';
// eslint-disable-next-line
const environment = (getQueryParameters(location).get('environment') || [])[0];

if (environment !== 'prod') {
  ReactDOM.render(
    <App token={token} environment={environment}/>,
    document.getElementById('root')
  );
} else {
  ReactDOM.render(
    <App token={token} />,
    document.getElementById('root')
  );
}
