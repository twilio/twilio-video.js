import webapp2
import json

from twilio.util import TwilioCapability

account_sid = None
auth_token = None

with open('twilio_credentials.json') as f:
    credentials = json.loads(f.read())
    account_sid = credentials['accountSid']
    auth_token = credentials['authToken']
    f.close()

class Token(webapp2.RequestHandler):
    def get(self):
        capability = TwilioCapability(account_sid, auth_token)
        name = self.request.GET.get('name', None)
        if name:
            capability.allow_client_incoming(name)
        self.response.headers['Content-Type'] = 'text/plain'
        self.response.write(capability.generate())

app = webapp2.WSGIApplication([
    ('/token', Token),
], debug=True)
