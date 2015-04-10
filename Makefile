# Version
PRODUCT_SUFFIX=conversations
PRODUCT=twilio-$(PRODUCT_SUFFIX)
MAJOR=$(shell sed -n 's/^  "version": "\([0-9]*\).[0-9]*.[0-9]*",$$/\1/gp' package.json)
MINOR=$(shell sed -n 's/^  "version": "[0-9]*.\([0-9]*\).[0-9]*",$$/\1/gp' package.json)
PATCH=$(shell sed -n 's/^  "version": "[0-9]*.[0-9]*.\([0-9]*\)",$$/\1/gp' package.json)
BUILD=1
COMMIT=$(shell git rev-parse --short=7 HEAD)
PUBLIC_VERSION=v$(MAJOR).$(MINOR)
RELEASE_VERSION=$(MAJOR).$(MINOR).$(PATCH).b$(BUILD)-$(COMMIT)

# Artifacts
PUBLIC_ROOT=build/sdk/$(PRODUCT_SUFFIX)/$(PUBLIC_VERSION)/js
PUBLIC_DOCS=$(PUBLIC_ROOT)/docs
PUBLIC_LOADER=$(PUBLIC_ROOT)/$(PRODUCT).js
PUBLIC_LOADER_MIN=$(PUBLIC_ROOT)/$(PRODUCT).min.js
RELEASE_ROOT=$(PUBLIC_ROOT)/releases/$(RELEASE_VERSION)
RELEASE_DOCS=$(RELEASE_ROOT)/docs
RELEASE_LOADER=$(RELEASE_ROOT)/$(PRODUCT)-loader.js
RELEASE_LOADER_MIN=$(RELEASE_ROOT)/$(PRODUCT)-loader.min.js
RELEASE=$(RELEASE_ROOT)/$(PRODUCT).js
RELEASE_MIN=$(RELEASE_ROOT)/$(PRODUCT).min.js

ALL=$(PUBLIC_LOADER) $(PUBLIC_LOADER_MIN) $(RELEASE_LOADER) $(RELEASE_LOADER_MIN) $(REALEASE) $(RELEASE_MIN) $(PUBLIC_DOCS) $(RELEASE_DOCS)

LIB_FILES=$(shell find lib -name \*.js)
SRC_FILES=$(shell find src -name \*.js)
TEST_FILES=$(shell find test -name \*.js)
PUBLIC_LIB_FILES=lib/conversation.js lib/endpoint.js lib/invite.js lib/participant.js lib/media/stream.js

# Tools
BROWSERIFY=node_modules/browserify/bin/cmd.js
GULP=node_modules/gulp/bin/gulp.js
JSDOC=node_modules/jsdoc/jsdoc.js
JSHINT=node_modules/jshint/bin/jshint
MOCHA=node_modules/mocha/bin/mocha
MOCHA_PHANTOMJS=node_modules/mocha-phantomjs/bin/mocha-phantomjs
UGLIFY=node_modules/uglify-js/bin/uglifyjs -b ascii-only

INFO=echo "\033[1;34m[$$(date "+%H:%M:%S")] $(1)\033[0m"

all: $(ALL)

clean:
	rm -rf build .LINTED .TESTED

clean-www:
	rm -rf www/venv www/httplib2 www/six.py www/twilio www/sdk

clean-all: clean clean-www

docs:
	@$(call INFO,"Generating docs")
	$(JSDOC) $(PUBLIC_LIB_FILES) -d $(RELEASE_DOCS) && touch $(RELEASE_DOCS)
	./scripts/remove-private-constructors.js $(RELEASE_DOCS)
	./scripts/prefix-static-methods.js $(RELEASE_DOCS)
	@# sed -i original 's/    color: #0095dd;/    color: #e12127;/' $(RELEASE_DOCS)/styles/jsdoc-default.css

lint:
	$(GULP) lint

publish: www/basic_auth.json www
	(cd www; ln -s -f sdk/$(PRODUCT)/$(PUBLIC_VERSION)/docs doc)
	appcfg.py update www --oauth2 \
		-E twilio_default_realm:prod

release-version:
	@echo $(RELEASE_VERSION)

serve: www
	dev_appserver.py www --skip_sdk_update_check

test: test.json
	$(MOCHA) --reporter=spec test/spec/index.js

test.json:
	@if [ ! -f test.json ]; then \
		echo "\n\nYou need to create \`test.json'."; \
		echo "See \`test.json.example'.\n\n"; \
		exit 1; \
	fi

www: www/twilio_credentials.json www/httplib2 www/six.py www/twilio www/sdk

.PHONY: all clean clean-all clean-www docs lint publish serve test

node_modules: package.json
	@$(call INFO,"Installing node_modules")
	npm install && touch node_modules
	$(GULP) patch

$(BROWSERIFY): node_modules

$(GULP): node_modules

$(JSDOC): node_modules

$(JSHINT): node_modules

$(MOCHA): node_modules

$(MOCHA_PHANTOMJS): node_modules

$(UGLIFY): node_modules

$(PUBLIC_DOCS): $(RELEASE_DOCS)
	@$(call INFO,"Symlinking public docs to release docs")
	(cd $(PUBLIC_ROOT); ln -s -f releases/$(RELEASE_VERSION)/docs .)

$(PUBLIC_LOADER): $(RELEASE_LOADER)
	@$(call INFO,"Symlinking public loader to release loader")
	(cd $(PUBLIC_ROOT); ln -s -f releases/$(RELEASE_VERSION)/$(PRODUCT)-loader.js $(PRODUCT).js)

$(PUBLIC_LOADER_MIN): $(RELEASE_LOADER_MIN)
	@$(call INFO,"Symlinking minified public loader to minified release loader")
	(cd $(PUBLIC_ROOT); ln -s -f releases/$(RELEASE_VERSION)/$(PRODUCT)-loader.min.js $(PRODUCT).min.js)

$(RELEASE_DOCS): $(JSDOC) $(LIB_FILES)
	@$(call INFO,"Generating release docs")
	$(JSDOC) $(PUBLIC_LIB_FILES) -d $(RELEASE_DOCS) && touch $(RELEASE_DOCS)
	./scripts/remove-private-constructors.js $(RELEASE_DOCS)
	./scripts/prefix-static-methods.js $(RELEASE_DOCS)
	@# sed -i original 's/    color: #0095dd;/    color: #e12127;/' $(RELEASE_DOCS)/styles/jsdoc-default.css

# $(RELEASE_LOADER): $(SRC_FILES)
$(RELEASE_LOADER): $(RELEASE)
	@# cp src/$(PRODUCT)-loader.js $(RELEASE_LOADER)
	@$(call INFO,"Symlinking release loader to release")
	(cd $(RELEASE_ROOT); ln -s -f $(PRODUCT).js $(PRODUCT)-loader.js)

# $(RELEASE_LOADER_MIN): $(UGLIFY) $(RELEASE_LOADER)
$(RELEASE_LOADER_MIN): $(RELEASE_MIN)
	@# cp $(UGLIFY) $(RELEASE_LOADER) -o $(RELEASE_LOADER_MIN)
	@$(call INFO,"Symlinking minified release loader to minified release")
	(cd $(RELEASE_ROOT); ln -s -f $(PRODUCT).min.js $(PRODUCT)-loader.min.js)

$(RELEASE): $(BROWSERIFY) $(LIB_FILES) $(SRC_FILES) .LINTED .TESTED
	@$(call INFO,"Building release")
	@mkdir -p $(RELEASE_ROOT)
	$(BROWSERIFY) src/$(PRODUCT).js -o $(RELEASE)

$(RELEASE_MIN): $(UGLIFY) $(RELEASE)
	@$(call INFO,"Minifying release")
	$(UGLIFY) $(RELEASE) -o $(RELEASE_MIN)

.LINTED: $(JSHINT) $(LIB_FILES) $(SRC_FILES) $(TEST_FILES)
	@if [[ -z "${SKIP_LINT}" ]]; then \
		$(call INFO,"Linting"); \
		make lint && touch .LINTED; \
	else \
		$(call INFO,"Skipped linting"); \
	fi

.TESTED: $(MOCHA) $(LIB_FILES) $(TEST_FILES)
	@if [[ -z "${SKIP_TEST}" ]]; then \
		$(call INFO,"Testing"); \
		make test && touch .TESTED; \
	else \
		$(call INFO,"Skipped testing"); \
	fi

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

www/venv:
	@$(call INFO,"Creating virtualenv")
	(cd www; bash -c 'virtualenv venv; source venv/bin/activate; pip install -r requirements.txt')

www/venv/lib/python2.7/site-packages/httplib2: www/venv

www/venv/lib/python2.7/site-packages/six.py: www/venv

www/venv/lib/python2.7/site-packages/twilio: www/venv

www/httplib2: www/venv/lib/python2.7/site-packages/httplib2
	@$(call INFO,"Symlinking httplib2")
	(cd www; ln -s -f venv/lib/python2.7/site-packages/httplib2 .)

www/six.py: www/venv/lib/python2.7/site-packages/six.py
	@$(call INFO,"Symlinking six.py")
	(cd www; ln -s -f venv/lib/python2.7/site-packages/six.py .)

www/twilio: www/venv/lib/python2.7/site-packages/twilio
	@$(call INFO,"Symlinking twilio")
	(cd www; ln -s -f venv/lib/python2.7/site-packages/twilio .)

www/sdk: $(PUBLIC_LOADER) $(PUBLIC_LOADER_MIN)
	@$(call INFO,"Symlinking sdk")
	(cd www; ln -s -f ../build/sdk .; touch sdk)

# browser-test: build/$(RELEASE_VERSION)/twilio-conversations.js \
# 							build/$(RELEASE_VERSION)/test/index.js \
# 							build/$(RELEASE_VERSION)/test/index.html \
# 							build/$(RELEASE_VERSION)/test/bower_components
# 	@cd build/$(RELEASE_VERSION); \
# 		python -m SimpleHTTPServer 9999 & \
# 		PID=$$?; \
# 		cd ../..; \
# 	$(mocha_phantomjs) -s webSecurityEnabled=false --reporter=spec http://localhost:9999/test/index.html; \
# 	kill -9 $${PID}

# test/bower_components: test/bower.json
# 	@cd test && bower install
