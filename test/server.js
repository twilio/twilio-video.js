var Server = require('ws').Server;
var server = new Server({ port: 8080 });

// Message types
var REGISTER = 'register';
var CONNECT = 'connect';

function type(request) {
  return isConnect(request)
      || isRegister(request);
}

function isConnect(request) {
  return request.type === CONNECT ? CONNECT : null;
}

var endpoint = 'endpoint';
var TWIML = 'twiml';

var targets = {
  'endpoint1@cheerful-owl.twil.io': endpoint,
  'twiml1.cheerful-owl.twil.io': TWIML
}

function handleConnect(request) {
  var domain = request.domain;
  var endpoint = request.endpoint;
  var target = request.target && request.target.name;
  var type = targets[target];
  if (!type) {
    // TODO(mroberts): Handle error.
  }
  return {
    domain: domain,
    type: CONNECT,
    endpoint: endpoint,
    target: {
      name: target,
      type: type
    }
  };
}

function isRegister(request) {
  return request.type === REGISTER ? REGISTER : null;
}

function handleRegister(request) {
  var domain = request.domain;
  var endpoint = request.endpoint;
  return {
    domain: domain,
    type: REGISTER,
    endpoint: endpoint
  };
}

server.on('connection', function(ws) {
  ws.on('message', function(data) {
    var request = JSON.parse(data);
    var response;
    switch (type(request)) {
      case CONNECT:
        response = handleConnect(request);
        break;
      case REGISTER:
        response = handleRegister(request);
        break;
      default:
        response = null;
    }
    ws.send(JSON.stringify(response));
  });
});

module.exports = server;
