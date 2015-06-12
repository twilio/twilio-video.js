'use strict';

var responses = {
  GET: {},
  POST: {}
};

function XMLHttpRequest() {
  this.readyState = 1;
}

XMLHttpRequest.respondWith = function(method, url, response) {
  responses[method] = responses[method] || {};
  responses[method][url] = response;
};

XMLHttpRequest.clearResponses = function() {
  responses.GET = {};
  responses.POST = {};
};

XMLHttpRequest.prototype.open = function(method, url) {
  this.onreadystatechange();

  var self = this;
  setTimeout(function() {
    for(var key in responses[method][url]) {
      self[key] = responses[method][url][key];
    }

    self.onreadystatechange();
  });
};

XMLHttpRequest.prototype.send = function() { };
XMLHttpRequest.prototype.onreadystatechange = function() { };
XMLHttpRequest.prototype.setRequestHeader = function() { };

module.exports = XMLHttpRequest;
