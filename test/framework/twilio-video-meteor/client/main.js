import { connect } from 'twilio-video';
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

import './main.html';

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

const token = (getQueryParameters(location).get('token') || [])[0] || '';

const error = new ReactiveVar(null);
const room = new ReactiveVar(null);
const disconnected = new ReactiveVar(false);

Template.body.onCreated(function() {
  this.error = error;
  this.room = room;
  this.disconnected = disconnected;
});

Template.body.helpers({
  error() {
    return Template.instance().error.get();
  },

  room() {
    return Template.instance().room.get();
  },

  disconnected() {
    return Template.instance().disconnected.get();
  }
});

connect(token).then(_room => {
  room.set(_room);
  _room.once('disconnected', disconnected.set(true));
  _room.disconnect();
}, _error => {
  error.set(_error);
});
