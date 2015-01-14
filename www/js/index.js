'use strict';

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
        loggedIn = null;
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
        loggedIn = endpoint;
        didLogIn(name);
      });
    }
  };
  return loginBtn;
}

function loggingOut() {
  loginBtn.disabled = true;
  var prevStatus = statusText.innerHTML;
  statusText.innerHTML = 'Logging out&hellip;';
  hide(loginAlert);
  return function restore(error) {
    loginBtn.disabled = false;
    statusText.innerHTML = prevStatus;
    if (error) {
      loginAlert.innerText = error;
      unhide(loginAlert);
    }
  };
}

function logOut(callback) {
  // TODO: Log out.
  callback();
}

function didLogOut() {
  loginBtn.innerText = 'Log In';
  loginBtn.className = loginBtn.className.replace(/btn-danger/, 'btn-success');
  loginBtn.disabled = false;
  loginValue.disabled = false;
  statusImg.src = 'img/twilio41x41gray.png';
  statusText.innerText = 'You are offline.';
  disableDialer();
}

function loggingIn() {
  loginBtn.disabled = true;
  loginValue.disabled = true;
  var prevStatus = statusText.innerHTML;
  statusText.innerHTML = 'Logging in&hellip;';
  hide(loginAlert);
  return function restore(error) {
    loginBtn.disabled = false;
    loginValue.disabled = false;
    statusText.innerHTML = prevStatus;
    if (error) {
      loginAlert.innerText = error;
      unhide(loginAlert);
      console.log(loginAlert);
    }
  };
}

function logIn(name, next) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'token?name=' + name, true);
  xhr.ontimeout = function ontimeout() {
    callback('Timed-out getting token from server.');
  };
  xhr.onreadystatechange = function onreadystatechange() {
    if (xhr.readyState === 4) {
      switch (xhr.status) {
        case 200:
          try {
            callback(null, xhr.responseText);
          } catch (e) {
            callback(e.message);
          }
          break;
        default:
          callback('Getting token from the server failed with "'
                 + xhr.status + ' ' + xhr.statusText + '"');
      }
    }
  };
  xhr.send();

  function callback(error, token) {
    if (error) {
      return next(error);
    }
    var endpoint = new Twilio.Endpoint(token, {
      'debug': 'true',
      'registrarServer': 'twil.io'
    });
    next(null, endpoint);
  }
}

function didLogIn(name) {
  loginBtn.innerText = 'Log Out';
  loginBtn.className = loginBtn.className.replace(/btn-success/, 'btn-danger');
  loginBtn.disabled = false;
  statusImg.src = 'img/twilio41x41.png';
  statusText.innerHTML = 'You are online as <b>' + name + '</b>.';
  enableDialer();
}

// Call
// ====

var callInProgress = false;

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
    // TODO: Mute audio.
    muted = !muted;
    muteBtn.innerText = muted ? 'Unmute' : 'Mute';
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
    // TODO: Pause video.
    paused = !paused;
    pauseBtn.innerText = paused ? 'Unpause' : 'Pause';
  };
  return pauseBtn;
}

// Call/Hang Up Flow
// -----------------

function setupCallBtn(callBtn) {
  callBtn.onclick = function(e) {
    e.preventDefault();
    callBtn.blur();
    var restore;
    if (callInProgress) {
      restore = hangingUp();
      // TODO: Hangup
      return didHangUp();
    }
    restore = calling();
    // TODO: Call
    didCall();
  };
  return callBtn;
}

function hangingUp() {
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
      callAlert.innerText = error;
      unhide(callAlert);
    }
  };
}

function didHangUp() {
  callInProgress = null;
  callValue.disabled = false;
  callBtn.innerText = 'Call';
  callBtn.className = callBtn.className.replace(/btn-danger/, 'btn-success');
  callBtn.disabled = false;
  dtmfBtns.forEach(function(btn) {
    btn.disabled = false;
  });
  // TODO: Unmute/unpause
  muted = false;
  paused = false;
  muteBtn.innerText = 'Mute';
  pauseBtn.innerText = 'Pause';
  if (!loggedIn) {
    disableDialer();
  }
}

function calling() {
  callValue.disabled = true;
  callBtn.disabled = true;
  dtmfBtns.forEach(function(btn) {
    btn.disabled = true;
  });
  hide(callAlert);
  return function restore(error) {
    callValue.disabled = false;
    callBtn.disabled = false;
    dtmfBtns.forEach(function(btn) {
      btn.disabled = false;
    });
    if (error) {
      callAlert.innerText = error;
      unhide(callAlert);
    }
  };
}

function didCall() {
  callInProgress = true;
  callBtn.innerText = 'Hang Up';
  callBtn.className = callBtn.className.replace(/btn-success/, 'btn-danger');
  callBtn.disabled = false;
  dtmfBtns.forEach(function(btn) {
    btn.disabled = false;
  });
  muteBtn.disabled = false;
  pauseBtn.disabled = false;
}

// Utilities
// ---------

function unhide(element) {
  element.className = element.className.replace(/hidden/, '');
}

function hide(element) {
  if (!element.className.match(/ hidden/)) {
    element.className += ' hidden';
  }
}

