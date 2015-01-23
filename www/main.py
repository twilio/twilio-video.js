import webapp2
import json

from twilio.rest import TwilioRestClient
from twilio.util import TwilioCapability
from webapp2_extras.routes import RedirectRoute

DEFAULT_REALM = 'dev'

account_sid = {}
auth_token = {}

with open('twilio_credentials.json') as f:
    credentials = json.loads(f.read())
    for realm in ['dev', 'stage', 'prod']:
        if realm in credentials:
            account_sid[realm] = credentials[realm]['accountSid']
            auth_token[realm] = credentials[realm]['authToken']
    f.close()

class Token(webapp2.RequestHandler):
    def get(self):
        realm = self.request.GET.get('realm', DEFAULT_REALM)
        if not realm in account_sid:
            return self.abort(404)
        capability = TwilioCapability(account_sid[realm], auth_token[realm])
        name = self.request.GET.get('name', None)
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
        token = {
            'capabilityToken': capability_token,
            'stunTurnToken': stun_turn_token
        }
        self.response.headers['Content-Type'] = 'application/json'
        self.response.write(json.dumps(token))

app = webapp2.WSGIApplication([
    RedirectRoute('/doc', redirect_to='/doc/'),
    ('/token', Token),
], debug=True)
