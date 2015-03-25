'use strict';

var realm = getURLParameter('realm') || 'stage';

function getURLParameter(name) {
  return decodeURIComponent(
      (new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [,''])[1]
        .replace(/\+/g, '%20')
    ) || null;
}

// Log In
// ======

var statusImg = document.getElementById('js-status-img');
var statusText = document.getElementById('js-status-text');

var loginValue = document.getElementById('js-login-value');
var loginBtn = setupLoginBtn(document.getElementById('js-login-btn'));
var loginAlert = document.getElementById('js-login-alert');

var loggedIn = null;

function setupLoginBtn(loginBtn) {
  loginBtn.onclick = function(e) {
    e.preventDefault();
    loginBtn.blur();
    var restore;
    if (loggedIn) {
      restore = loggingOut();
      logOut(function(error) {
        if (error) {
          return restore(error);
        }
        didLogOut();
      });
    } else {
      restore = loggingIn();
      var name = loginValue.value;
      if (!name) {
        return restore('You must specify a name.');
      }
      logIn(loginValue.value, function(error, endpoint) {
        if (error) {
          return restore(error);
        }
        endpoint.on('invite', function(invite) {
          if (loggedIn !== endpoint || (callInProgress && callInProgress !== invite.conversation)) {
            return;
          }
          incoming(invite);
        });
        didLogIn(endpoint);
      });
    }
  };
  return loginBtn;
}

var incomingStatus = document.getElementById('js-incoming-status');
var incomingPanel = document.getElementById('js-incoming-panel');
var acceptBtn = document.getElementById('js-btn-accept');
var rejectBtn = document.getElementById('js-btn-reject');
var ignoreBtn = setupIgnoreBtn(document.getElementById('js-btn-ignore'));

function setAcceptBtnOnClick(invite) {
  acceptBtn.onclick = function onclick(e) {
    e.preventDefault();
    if (loggedIn) {
      acceptBtn.disabled = true;
      rejectBtn.disabled = true;
      ignoreBtn.disabled = true;
      invite.accept()
        .done(function(conversation) {
          stopFlicker(statusImg, function() {
            acceptBtn.disabled = false;
            rejectBtn.disabled = false;
            ignoreBtn.disabled = false;
            hide(incomingPanel);
            enableDialer();
            didCall(conversation);
            callValue.value = invite.from;
            callValue.disabled = true;
          });
        }, function(error) {
          stopFlicker(statusImg, function() {
            acceptBtn.disabled = false;
            rejectBtn.disabled = false;
            ignoreBtn.disabled = false;
            hide(incomingPanel);
            enableDialer();
            console.log(error);
          });
        });
    }
  };
  return acceptBtn;
}

function setRejectBtnOnClick(invite) {
  rejectBtn.onclick = function onclick(e) {
    e.preventDefault();
    if (loggedIn) {
      acceptBtn.disabled = true;
      rejectBtn.disabled = true;
      ignoreBtn.disabled = true;
      invite.reject()
        .done(function(conversation) {
          stopFlicker(statusImg, function() {
            acceptBtn.disabled = false;
            rejectBtn.disabled = false;
            ignoreBtn.disabled = false;
            hide(incomingPanel);
            enableDialer();
          });
        }, function(error) {
          stopFlicker(statusImg, function() {
            acceptBtn.disabled = false;
            rejectBtn.disabled = false;
            ignoreBtn.disabled = false;
            hide(incomingPanel);
            enableDialer();
            console.log(error);
          });
        });
    }
  };
  return rejectBtn;
}

function setupIgnoreBtn(ignoreBtn) {
  ignoreBtn.onclick = function onclick(e) {
    e.preventDefault();
    ignoreBtn.blur();
    hide(incomingPanel);
    stopFlicker(statusImg, function() {
      incomingStatus.innerHTML = 'No one is calling you.';
      enableDialer();
    });
  };
  return ignoreBtn;
}

function incoming(invite) {
  startFlicker(statusImg);
  disableDialer();
  incomingStatus.innerHTML = '<b>' + invite.from + '</b> is calling you.';
  unhide(incomingPanel);
  setAcceptBtnOnClick(invite);
  setRejectBtnOnClick(invite);
}

function loggingOut() {
  loginBtn.disabled = true;
  var prevStatus = statusText.innerHTML;
  startFlicker(statusImg);
  statusText.innerHTML = 'Logging out&hellip;';
  hide(loginAlert);
  return function restore(error) {
    stopFlicker(statusImg, function() {
      loginBtn.disabled = false;
      statusText.innerHTML = prevStatus;
      if (error) {
        loginAlert.innerHTML = error;
        unhide(loginAlert);
      }
    });
  };
}

function logOut(callback) {
  loggedIn.unlisten().done(function() {
    callback();
  }, function(error) {
    callback(error);
  });
}

function didLogOut() {
  loggedIn = null;
  stopFlicker(statusImg, function() {
    loginBtn.innerHTML = 'Log In';
    loginBtn.className = loginBtn.className.replace(/btn-danger/, 'btn-success');
    loginBtn.disabled = false;
    loginValue.disabled = false;
    statusImg.src = 'img/twilio41x41gray.png';
    statusText.innerHTML = 'You are offline.';
  });
  disableDialer();
}

function loggingIn() {
  loginBtn.disabled = true;
  loginValue.disabled = true;
  var prevStatus = statusText.innerHTML;
  startFlicker(statusImg);
  statusText.innerHTML = 'Logging in&hellip;';
  hide(loginAlert);
  return function restore(error) {
    stopFlicker(statusImg, function() {
      loginBtn.disabled = false;
      loginValue.disabled = false;
      statusText.innerHTML = prevStatus;
      if (error) {
        loginAlert.innerHTML = error;
        unhide(loginAlert);
        console.log(loginAlert);
      }
    });
  };
}

function logIn(name, next) {
  function callback(error, config) {
    if (error) {
      return next(error);
    }
    console.log('Got here');
    var endpoint = new Twilio.Signal.Endpoint(config['token']['capability_token'], {
      'debug': true,
      'register': false,
      'registrarServer': 'twil.io',
      'wsServer': 'ws://' + config['ws_server']
    });
    console.log('Got there');
    endpoint.listen().done(function() {
      next(null, endpoint);
    }, function(error) {
      next(error);
    });
  }

  name = encodeURIComponent(name);
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'config?name=' + name, true);
  xhr.ontimeout = function ontimeout() {
    callback('Timed-out getting token from server.');
  };
  xhr.onreadystatechange = function onreadystatechange() {
    if (xhr.readyState === 4) {
      switch (xhr.status) {
        case 200:
          try {
            var config = JSON.parse(xhr.responseText);
            // config['token'] = JSON.stringify(config['token']);
            callback(null, config);
          } catch (e) {
            callback(e.message);
            throw e;
          }
          break;
        default:
          callback('Getting token from the server failed with "'
                 + xhr.status + ' ' + xhr.statusText + '"');
      }
    }
  };
  xhr.send();
}

function didLogIn(endpoint) {
  loggedIn = endpoint;
  var name = endpoint.address;
  stopFlicker(statusImg, function() {
    loginBtn.innerHTML = 'Log Out';
    loginBtn.className = loginBtn.className.replace(/btn-success/, 'btn-danger');
    loginBtn.disabled = false;
    statusImg.src = 'img/twilio41x41.png';
    statusText.innerHTML = 'You are online as <b>' + name + '</b>.';
    enableDialer();
    callValue.focus();
  });
}

// Call
// ====

var callInProgress = null;

var callValue = document.getElementById('js-call-value');

var dtmfBtns =
  ['1', '2', '3',
   '4', '5', '6',
   '7', '8', '9',
   'star', '0', 'pound'].map(function(dtmf) {
     var id = 'js-btn-' + dtmf;
     var dtmfBtn = document.getElementById(id);
     return setupDTMFBtn(dtmfBtn, dtmf);
   });

var callBtn = setupCallBtn(document.getElementById('js-btn-call'));
var callAlert = document.getElementById('js-call-alert');

var muteBtn = setupMuteBtn(document.getElementById('js-btn-mute'));
var muted = false;

var pauseBtn = setupPauseBtn(document.getElementById('js-btn-pause'));
var paused = false;

function enableDialer() {
  callValue.disabled = false;
  dtmfBtns.forEach(function(btn) {
    btn.disabled = false;
  });
  callBtn.disabled = false;
}

function disableDialer() {
  if (!callInProgress) {
    callValue.disabled = true;
    dtmfBtns.forEach(function(btn) {
      btn.disabled = true;
    });
    callBtn.disabled = true;
  }
}

// DTMF Buttons
// ------------

function setupDTMFBtn(dtmfBtn, dtmf) {
  dtmfBtn.onclick = function onclick(e) {
    e.preventDefault();
    dtmfBtn.blur();
    if (callInProgress) {
      // TODO: Send DTMF.
      return;
    }
    switch (dtmf) {
      case 'star':
        dtmf = '*';
        break;
      case 'pound':
        dtmf = '#';
        break;
    }
    callValue.value += dtmf;
  };
  return dtmfBtn;
}

// Mute/Pause Buttons
// ------------------

function setupMuteBtn(muteBtn) {
  muteBtn.onclick = function(e) {
    e.preventDefault();
    muteBtn.blur();
    if (!callInProgress) {
      return;
    }
    // TODO(mroberts): Rethink loggedIn...
    muted = !muted;
    if (loggedIn) {
      loggedIn.muteAudio(muted);
    }
    muteBtn.innerHTML = muted ? 'Unmute' : 'Mute';
  };
  return muteBtn;
}

function setupPauseBtn(pauseBtn) {
  pauseBtn.onclick = function(e) {
    e.preventDefault();
    pauseBtn.blur();
    if (!callInProgress) {
      return;
    }
    // TODO(mroberts): Rethink loggedIn...
    paused = !paused;
    if (loggedIn) {
      loggedIn.pauseVideo(paused);
    }
    pauseBtn.innerHTML = paused ? 'Unpause' : 'Pause';
  };
  return pauseBtn;
}

// Call/Hang Up Flow
// -----------------

var cancel = null;

function setupCallBtn(callBtn) {
  callBtn.onclick = function(e) {
    e.preventDefault();
    callBtn.blur();
    var restore;
    if (cancel) {
      cancel();
      cancel = null;
      return;
    } if (callInProgress) {
      restore = hangingUp();
      // Hangup
      return loggedIn.leave(callInProgress)
        .done(function() {
          callInProgress = null;
          return; // didHangUp();
        }, function(error) {
          restore(error.message);
        });
    }
    restore = calling();
    // Call
    loggedIn.invite(callValue.value)
      .done(function(conversation) {
        // FIXME(mroberts): ...
        // cancel = function cancel() {
        //   loggedIn.leave(conversation);
        //   restore();
        // };
        conversation.once('participantJoined', function(participant) {
          cancel = null;
          didCall(conversation);
        });
      }, function(error) {
        restore(error.message);
      });
  };
  return callBtn;
}

function hangingUp() {
  startFlicker(statusImg);
  callBtn.disabled = true;
  dtmfBtns.forEach(function(btn) {
    btn.disabled = true;
  });
  muteBtn.disabled = true;
  pauseBtn.disabled = true;
  hide(callAlert);
  return function restore(error) {
    callBtn.disabled = false;
    dtmfBtns.forEach(function(btn) {
      btn.disabled = false;
    });
    muteBtn.disabled = false;
    pauseBtn.disabled = false;
    if (error) {
      callAlert.innerHTML = error;
      unhide(callAlert);
    }
  };
}

function didHangUp() {
  callInProgress = null;
  stopDisplayingConversation(callInProgress);
  stopFlicker(statusImg, function() {
    callValue.disabled = false;
    callBtn.innerHTML = 'Call';
    callBtn.className = callBtn.className.replace(/btn-danger/, 'btn-success');
    callBtn.disabled = false;
    dtmfBtns.forEach(function(btn) {
      btn.disabled = false;
    });
    // TODO: Unmute/unpause
    muted = false;
    paused = false;
    muteBtn.innerHTML = 'Mute';
    pauseBtn.innerHTML = 'Pause';
    if (!loggedIn) {
      disableDialer();
    } else {
      callValue.focus();
    }
  });
}

function calling() {
  startFlicker(statusImg);
  callValue.disabled = true;
  // callBtn.disabled = true;
  callBtn.className = callBtn.className.replace(/btn-success/, 'btn-danger');
  callBtn.innerHTML = 'Cancel';
  dtmfBtns.forEach(function(btn) {
    btn.disabled = true;
  });
  hide(callAlert);
  return function restore(error) {
    stopFlicker(statusImg, function() {
      callValue.disabled = false;
      // callBtn.disabled = false;
      callBtn.className = callBtn.className.replace(/btn-danger/, 'btn-success');
      callBtn.innerHTML = 'Call';
      dtmfBtns.forEach(function(btn) {
        btn.disabled = false;
      });
      if (error) {
        callAlert.innerHTML = error;
        unhide(callAlert);
      }
    });
  };
}

function didCall(conversation) {
  callInProgress = conversation;
  startDisplayingConversation(conversation);
  stopFlicker(statusImg, function() {
    callBtn.innerHTML = 'Hang Up';
    callBtn.className = callBtn.className.replace(/btn-success/, 'btn-danger');
    callBtn.disabled = false;
    dtmfBtns.forEach(function(btn) {
      btn.disabled = false;
    });
    muteBtn.disabled = false;
    pauseBtn.disabled = false;
  });
  conversation.once('participantLeft', function(participant) {
    if (loggedIn) {
      loggedIn.leave(conversation);
    }
    didHangUp();
  });
}

// Conversation Display
// ---------------

var center = document.getElementById('js-center');
var videoDiv = null;
var remoteVideos = null;
var localVideos = null;

function startDisplayingConversation(conversation) {
  var remoteVideoDiv = document.createElement('div');
  remoteVideoDiv.className += ' js-remote-video-div';
  var remoteStreams = conversation.getRemoteStreams();
  remoteVideos = remoteStreams.map(function(remoteStream) {
    var remoteVideo = remoteStream.attach();
    remoteVideo.className += ' js-remote-video';
    remoteVideoDiv.appendChild(remoteVideo);
    return remoteVideo;
  });

  var localVideoDiv = document.createElement('div');
  localVideoDiv.className += ' js-local-video-div';
  var localStreams = conversation.getLocalStreams(loggedIn);
  localVideos = localStreams.map(function(localStream) {
    var localVideo = localStream.attach();
    localVideo.className += ' js-local-video';
    localVideoDiv.appendChild(localVideo);
    return localVideo;
  });

  videoDiv = document.createElement('div');
  videoDiv.className += ' js-video-div';
  videoDiv.appendChild(remoteVideoDiv);
  videoDiv.appendChild(localVideoDiv);

  center.appendChild(videoDiv);
}

function stopDisplayingConversation() {
  remoteVideos.forEach(function(remoteVideo) {
    remoteVideo.pause();
  });
  remoteVideos = null;
  localVideos.forEach(function(localVideo) {
    localVideo.pause();
  });
  localVideos = null;
  center.removeChild(videoDiv);
  videoDiv = null;
}

// Utilities
// ---------

function stopFlicker(element, callback) {
  var event;
  function stop() {
    element.removeEventListener(event, stop);
    element.className = element.className.replace(/animate-flicker/, '');
    callback();
  }
  if (element.className.match(/ animate-flicker/)) {
    var animationEvents = {
      animation: 'animationiteration',
      OAnimation: 'oAnimationIteration',
      MozAnimation: 'animationiteration',
      WebkitAnimation: 'webkitAnimationIteration'
    };
    for (var name in animationEvents) {
      if (element.style[name] !== undefined) {
        event = animationEvents[name];
        element.addEventListener(event, stop);
        break;
      }
    }
  } else {
    callback();
  }
}

function startFlicker(element) {
  if (!element.className.match(/ animate-flicker/)) {
    element.className += ' animate-flicker';
  }
}

function unhide(element) {
  element.className = element.className.replace(/hidden/, '');
}

function hide(element) {
  if (!element.className.match(/ hidden/)) {
    element.className += ' hidden';
  }
}
