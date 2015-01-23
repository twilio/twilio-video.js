import base64
import json
import mimetypes
import os
import os.path
import webapp2

from twilio.rest import TwilioRestClient
from twilio.util import TwilioCapability
from webapp2_extras.routes import RedirectRoute

ALLOWED_REALMS = os.environ.get('twilio_allowed_realms').split(',')
DEFAULT_REALM = os.environ.get('twilio_default_realm')

account_sid = {}
auth_token = {}
basic_auth = None

with open('twilio_credentials.json') as twilio_credentials_file:
    credentials = json.loads(twilio_credentials_file.read())
    for allowed_realm in ALLOWED_REALMS:
        if allowed_realm not in credentials:
            continue
        account_sid[allowed_realm] = credentials[allowed_realm]['accountSid']
        auth_token[allowed_realm] = credentials[allowed_realm]['authToken']
    twilio_credentials_file.close()

if os.path.isfile('basic_auth.json'):
    with open('basic_auth.json') as basic_auth_file:
        basic_auth_json = json.loads(basic_auth_file.read())
        basic_auth = {
            'username': basic_auth_json['username'],
            'password': basic_auth_json['password']
        }
        basic_auth_file.close()

def make_ws_server(realm):
    if realm == 'prod':
        return 'public-sip0.twilio.com'
    else:
        return 'public-sip0.{}-us1.twilio.com'.format(realm)

def make_token(realm, name):
    capability = TwilioCapability(account_sid[realm], auth_token[realm])
    if name:
        capability.allow_client_incoming(name)
    # Dummy Application SID for the outgoing capability
    capability.allow_client_outgoing('AP00000000000000000000000000000000')
    capability_token = capability.generate()
    client = TwilioRestClient(account_sid[realm], auth_token[realm],
            base='https://api.{}twilio.com'.format(
                    (realm + '.') if realm != 'prod' else ''))
    try:
        stun_turn_token = client.tokens.create()
    except Exception:
        stun_turn_token = None
    if stun_turn_token:
        stun_turn_token = {
            'date_updated': stun_turn_token.date_updated,
            'username': stun_turn_token.username,
            'account_sid': stun_turn_token.account_sid,
            'password': stun_turn_token.password,
            'date_created': stun_turn_token.date_created,
            'ice_servers': stun_turn_token.ice_servers,
            'ttl': stun_turn_token.ttl
        }
    return {
        'capabilityToken': capability_token,
        'stunTurnToken': stun_turn_token
    }

def make_config(realm, name):
    return {
        'token': make_token(realm, name),
        'wsServer': make_ws_server(realm)
    }

def login_required(handler_method):
    def check_login(self, *args, **kwargs):
        if not basic_auth:
            return handler_method(self, *args, **kwargs)
        auth = self.request.headers.get('Authorization')
        if not auth:
            return self.abort(401, headers=[
                    ('WWW-Authenticate', 'Basic realm="Please log in"')
                ])
        try:
            username, password = base64.decodestring(auth[6:]).split(':')
        except Exception:
            return self.abort(403)
        if basic_auth and (username != basic_auth['username'] or
                           password != basic_auth['password']):
            return self.abort(403)
        return handler_method(self, *args, **kwargs)
    return check_login

def Static(root):
    class StaticHandler(webapp2.RequestHandler):
        @login_required
        def get(self, filepath):
            filepath = os.path.normpath(filepath)
            if os.path.commonprefix([root, filepath]) != root:
                return self.abort(404)
            filepath = os.path.abspath(filepath)
            if not os.path.isfile(filepath):
                return self.abort(404, filepath)
            with open(filepath) as f:
                content_type = mimetypes.guess_type(filepath)
                if content_type:
                    self.response.headers['Content-Type'] = content_type[0]
                self.response.body_file.write(f.read())
                f.close()
    return StaticHandler

class Config(webapp2.RequestHandler):
    @login_required
    def get(self):
        realm = self.request.GET.get('realm', DEFAULT_REALM)
        if realm not in ALLOWED_REALMS:
            return self.abort(404)
        name = self.request.GET.get('name', None)
        config = make_config(realm, name)
        self.response.headers['Content-Type'] = 'application/json'
        self.response.write(json.dumps(config))

class Token(webapp2.RequestHandler):
    @login_required
    def get(self):
        realm = self.request.GET.get('realm', DEFAULT_REALM)
        if realm not in ALLOWED_REALMS:
            return self.abort(404)
        name = self.request.GET.get('name', None)
        token = make_token(realm, name)
        self.response.headers['Content-Type'] = 'application/json'
        self.response.write(json.dumps(token))

app = webapp2.WSGIApplication([
    RedirectRoute('/', redirect_to='/index.html'),
    RedirectRoute('/doc', redirect_to='/doc/'),
    RedirectRoute('/doc/', redirect_to='/doc/index.html'),
    ('/(index\.html)', Static('')),
    ('/(doc/.+)', Static('doc')),
    ('/(js/.+)', Static('js')),
    ('/token\??.*', Token),
    ('/config\??.*', Config),
], debug=True)
