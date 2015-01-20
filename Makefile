gulp=./node_modules/gulp/bin/gulp.js

all:
	make clean
	make dist/twilio-signal.js

dist/twilio-signal.js: node_modules
	$(gulp) build && cp dist/twilio-signal.*.js dist/twilio-signal.js

doc: node_modules
	$(gulp) doc

node_modules:
	npm install
	$(gulp) patch

www: www/twilio_credentials.json www/js/twilio-signal.js
	@cd www; \
		bash -c \
			'virtualenv-2.7 venv; source venv/bin/activate; pip install twilio'; \
		rm -f httplib2 six.py twilio; \
		ln -s venv/lib/python2.7/site-packages/httplib2 .; \
		ln -s venv/lib/python2.7/site-packages/six.py .; \
		ln -s venv/lib/python2.7/site-packages/twilio .; \
	cd ..

www/twilio_credentials.json:
	@if [ ! -f www/twilio_credentials.json ]; then \
		echo -e "\n\nYou need to create \`www/twilio_credentials.json'."; \
		echo -e "See \`www/twilio_credentials.json.example'.\n"; \
		exit 1; \
	fi

www/js/twilio-signal.js: dist/twilio-signal.js
	cp dist/twilio-signal.js www/js/twilio-signal.js

.PHONY: all clean clean-all clean-doc clean-node_modules clean-www lint \
	publish serve test

clean:
	rm -rf dist

clean-all: clean clean-doc clean-node_modules clean-www

clean-doc:
	rm -rf doc

clean-node_modules:
	rm -rf node_modules

clean-www:
	rm -rf www/js/twilio-signal.js www/venv www/httplib2 www/six.py www/twilio

lint: node_modules
	$(gulp) lint

publish: www
	appcfg.py update www --oauth2

serve: www
	dev_appserver.py www --skip_sdk_update_check

test: node_modules
	$(gulp) test
