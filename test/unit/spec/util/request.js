'use strict';

var assert = require('assert');
var sinon = require('sinon');

var Request = require('../../../../lib/util/request');
var XHR = require('../../mock/xmlhttprequest');

describe('Request', function() {
  var xhr;
  var method = 'GET';
  var url = '/foo';
  var responseText = 'foo';
  var params;
  var options;

  beforeEach(function() {
    xhr = new XHR();
    params = { url: url };
    options = {
      xmlHttpRequestFactory: function() { return xhr; }
    };
  });

  afterEach(function() {
    XHR.clearResponses();
  });

  describe('new Request(method, params)', function() {
    it('should call XMLHttpRequest#open(method, params.url, true)', function() {
      xhr.open = sinon.spy(xhr.open);
      var request = new Request(method, params, options);
      sinon.assert.calledWith(xhr.open, method, params.url, true);
    });

    it('should call XMLHttpRequest#setRequestHeader for each param.header passed', function() {
      xhr.setRequestHeader = sinon.spy(xhr.setRequestHeader);
      params.headers = {
        foo: 'bar',
        baz: 'qux'
      };
      Request(method, params, options);
      sinon.assert.calledWith(xhr.setRequestHeader, 'foo', 'bar');
      sinon.assert.calledWith(xhr.setRequestHeader, 'baz', 'qux');
    });

    context('on success', function() {
      it('should return a Promise that resolves to the responseText', function(done) {
        XHR.respondWith(method, url, {
          responseText: responseText,
          status: 200,
          readyState: 4
        });

        var promise = Request(method, params, options);
        promise.then(function(_responseText) {
          assert.equal(responseText, _responseText);
        }).then(done, done);
      });
    });

    context('on failure', function() {
      it('should return a Promise that rejects with an Error containing the responseText', function(done) {
        XHR.respondWith(method, url, {
          responseText: responseText,
          status: 404,
          readyState: 4
        });

        var promise = Request(method, params, options);
        promise.then(done, function(error) {
          assert.equal(responseText, error.message);
        }).then(done, done);
      });
    });
  });

  describe('.get(params)', function() {
    it("should call Request('GET', params)", function() {
      Request = sinon.spy(Request);
      Request.get(params, options);
      sinon.assert.calledWith(Request, 'GET', params);
    });
  });

  describe('.post(params)', function() {
    it("should call Request('POST', params)", function() {
      Request = sinon.spy(Request);
      Request.post(params, options);
      sinon.assert.calledWith(Request, 'POST', params);
    });
  });
});
