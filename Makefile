all:
	npm install
	./node_modules/gulp/bin/gulp.js

www/twilio_credentials.json:
	@if [ ! -f www/twilio_credentials.json ]; then \
		echo "You need to create \`www/twilio_credentials.json'."; \
		echo "See \`www/twilio_credentials.json.example'."; \
		exit 1; \
	fi

publish: www/twilio_credentials.json
	cp dist/twilio-signal.* www/js
	@cd www; \
		bash -c 'virtualenv-2.7 venv; source venv/bin/activate; pip install twilio'; \
		rm -f httplib2 six.py twilio; \
		ln -s venv/lib/python2.7/site-packages/httplib2 .; \
		ln -s venv/lib/python2.7/site-packages/six.py .; \
		ln -s venv/lib/python2.7/site-packages/twilio .; \
		appcfg.py update . --oauth2; \
	cd ..

.PHONY: all
