VERSION=$(shell \
	grep '^  "version": "[0-9]\+.[0-9]\+.[0-9]\+",$$' <package.json \
		| grep -o '[0-9]\+.[0-9]\+.[0-9]\+')

gulp=./node_modules/gulp/bin/gulp.js
mocha=node_modules/mocha/bin/mocha
mocha_phantomjs=node_modules/mocha-phantomjs/bin/mocha-phantomjs

all:
	make clean
	make build/$(VERSION)/twilio-signal.js

build/$(VERSION)/twilio-signal.js: node_modules
	$(gulp) build || exit 1
	cd build/$(VERSION); \
		ln -s twilio-signal.$(VERSION).js twilio-signal.js; \
		ln -s twilio-signal.$(VERSION).min.js twilio-signal.min.js;

doc: node_modules
	make clean-doc
	$(gulp) doc

node_modules:
	npm install
	$(gulp) patch

www: www/twilio_credentials.json www/js/twilio-signal.js
	cd www; \
		bash -c \
			'virtualenv venv; source venv/bin/activate; pip install -r requirements.txt'; \
		rm -f httplib2 six.py twilio; \
		ln -s venv/lib/python2.7/site-packages/httplib2 .; \
		ln -s venv/lib/python2.7/site-packages/six.py .; \
		ln -s venv/lib/python2.7/site-packages/twilio .; \
	cd ..

www/basic_auth.json:
	@if [ ! -f www/basic_auth.json ]; then \
		echo "\n\nYou probably should not be publishing!\n\n"; \
		exit 1; \
	fi

www/twilio_credentials.json:
	@if [ ! -f www/twilio_credentials.json ]; then \
		echo "\n\nYou need to create \`www/twilio_credentials.json'."; \
		echo "See \`www/twilio_credentials.json.example'.\n\n"; \
		exit 1; \
	fi

www/js/twilio-signal.js: build/$(VERSION)/twilio-signal.js
	cp build/$(VERSION)/twilio-signal.$(VERSION).js www/js/twilio-signal.js; \
	cp build/$(VERSION)/twilio-signal.$(VERSION).min.js www/js/twilio-signal.min.js;

.PHONY: all clean clean-all clean-doc clean-node_modules clean-www doc lint \
	publish serve test

clean:
	rm -rf build

clean-all: clean clean-doc clean-node_modules clean-www

clean-doc:
	rm -rf doc

clean-node_modules:
	rm -rf node_modules

clean-www:
	rm -rf www/js/twilio-signal.js www/doc www/venv www/httplib2 www/six.py www/twilio

lint: node_modules
	$(gulp) lint

publish: www/basic_auth.json doc www
	rm -rf www/doc
	cp -R doc www/doc
	appcfg.py update www --oauth2 \
		-E twilio_allowed_realms:prod \
		-E twilio_default_realm:prod

serve: www
	dev_appserver.py www --skip_sdk_update_check

test: node_modules
	@$(mocha) --reporter=spec test/spec/index.js

browser-test: build/$(VERSION)/twilio-signal.js \
							build/$(VERSION)/test/index.js \
							build/$(VERSION)/test/index.html \
							build/$(VERSION)/test/bower_components
	@cd build/$(VERSION); \
		python -m SimpleHTTPServer 9999 & \
		PID=$$?; \
		cd ../..; \
	$(mocha_phantomjs) -s webSecurityEnabled=false --reporter=spec http://localhost:9999/test/index.html; \
	kill -9 $${PID}

build/$(VERSION)/test/index.js: test/spec/*.js
	@$(gulp) build-browser-test

build/$(VERSION)/test/index.html: test/index.html
	@cp test/index.html build/$(VERSION)/test/index.html

build/$(VERSION)/test/bower_components: test/bower_components
	@ln -s ../../../test/bower_components build/$(VERSION)/test/bower_components

test/bower_components: test/bower.json
	@cd test && bower install
