# Version
PRODUCT=twilio-rtc-conversations
MAJOR=$(shell sed -n 's/^  "version": "\([0-9]*\).[0-9]*.[0-9]*",$$/\1/gp' package.json)
MINOR=$(shell sed -n 's/^  "version": "[0-9]*.\([0-9]*\).[0-9]*",$$/\1/gp' package.json)
PATCH=$(shell sed -n 's/^  "version": "[0-9]*.[0-9]*.\([0-9]*\)",$$/\1/gp' package.json)
BUILD=1
COMMIT=$(shell git rev-parse --short=7 HEAD)
PUBLIC_VERSION=v$(MAJOR).$(MINOR)
RELEASE_VERSION=$(MAJOR).$(MINOR).$(PATCH).b$(BUILD)-$(COMMIT)

ROOT=build/sdk/rtc/js
PUBLIC_ROOT=$(ROOT)/conversations/$(PUBLIC_VERSION)
RELEASE_ROOT=$(ROOT)/conversations/releases/$(RELEASE_VERSION)

# Artifacts
JS=$(ROOT)/$(PUBLIC_VERSION)/$(PRODUCT).js
MIN_JS=$(ROOT)/$(PUBLIC_VERSION)/$(PRODUCT).min.js

LATEST_JS=$(ROOT)/latest/$(PRODUCT).js
LATEST_MIN_JS=$(ROOT)/latest/$(PRODUCT).min.js

PUBLIC_JS=$(PUBLIC_ROOT)/$(PRODUCT).js
PUBLIC_MIN_JS=$(PUBLIC_JS:%.js=%.min.js)
PUBLIC_DOCS=$(PUBLIC_ROOT)/docs

RELEASE_JS=$(RELEASE_ROOT)/$(PRODUCT).js
RELEASE_MIN_JS=$(RELEASE_JS:%.js=%.min.js)
RELEASE_API_DOCS=$(RELEASE_ROOT)/docs/api

ALL= \
	$(JS) \
	$(MIN_JS) \
	$(LATEST_JS) \
	$(LATEST_MIN_JS) \
	$(PUBLIC_DOCS) \
	$(PUBLIC_JS) \
	$(PUBLIC_MIN_JS) \
	$(RELEASE_JS) \
	$(RELEASE_MIN_JS) \
	$(RELEASE_API_DOCS)

# Sources
INTEGRATION_TEST_FILES=$(shell find test/integration -name \*.js)
LIB_FILES=$(shell find lib -name \*.js)
SRC_FILES=$(shell find src -name \*.js)
UNIT_TEST_FILES=$(shell find test/unit -name \*.js)

# Public APIs (we generate JSDoc for these)
PUBLIC_LIB_FILES= \
	lib/accesstoken.js \
	lib/client.js \
	lib/conversation.js \
	lib/invite.js \
	lib/media/index.js \
	lib/media/localmedia.js \
	lib/media/track/index.js \
	lib/media/track/audiotrack.js \
	lib/media/track/videotrack.js \
	lib/participant.js \
	lib/webrtc/getusermedia.js \
	src/twilio-rtc-conversations.js

# Tools
BROWSERIFY=node_modules/browserify/bin/cmd.js
CLOSURE=node_modules/closurecompiler/bin/ccjs
ISTANBUL=node_modules/istanbul/lib/cli.js
JSDOC=node_modules/jsdoc/jsdoc.js
JSDOC_CONF=jsdoc.conf
JSHINT=node_modules/jshint/bin/jshint
_MOCHA=node_modules/mocha/bin/_mocha
MOCHA=node_modules/mocha/bin/mocha
MOCHA_PHANTOMJS=node_modules/mocha-phantomjs/bin/mocha-phantomjs

INFO=echo "\033[1;34m[$$(date "+%H:%M:%S")] $(1)\033[0m"

all: $(ALL)

clean:
	rm -rf build .INTEGRATION_TESTED .LINTED .UNIT_TESTED

clean-all: clean

docs:
	@$(call INFO,"Generating docs")
	$(JSDOC) $(PUBLIC_LIB_FILES) -d $(RELEASE_API_DOCS) -c ${JSDOC_CONF} && touch $(RELEASE_API_DOCS)
	./scripts/remove-private-constructors.js $(RELEASE_API_DOCS)
	./scripts/prefix-public-constructors.js $(RELEASE_API_DOCS)
	./scripts/prefix-static-methods.js $(RELEASE_API_DOCS)
	./scripts/reorder-navigation.js $(RELEASE_API_DOCS)

integration: node_modules test.json
	$(MOCHA) --reporter=spec test/integration/index.js

lint: node_modules
	$(JSHINT) $(LIB_FILES) $(SRC_FILES) --reporter node_modules/jshint-stylish/stylish.js

publish: simple-signaling.appspot.com
	cd simple-signaling.appspot.com && make publish

release-version:
	@echo $(RELEASE_VERSION)

serve: simple-signaling.appspot.com/sdk
	cd simple-signaling.appspot.com && make serve

test: unit integration

test.json:
	@if [ ! -f test.json ]; then \
		echo "\n\nYou need to create \`test.json'."; \
		echo "See \`test.json.example'.\n\n"; \
		exit 1; \
	fi

unit: node_modules
	$(MOCHA) --reporter=spec test/unit/index.js

coverage: node_modules
	node $(ISTANBUL) cover \
		-x lib/util/constants.js \
		-x lib/webrtc/getusermedia.js \
		$(_MOCHA) -- test/unit -R spec

watch: node_modules
	$(MOCHA) -w lib -w test/unit -R dot

simple-signaling.appspot.com:
	git submodule init
	git submodule update

simple-signaling.appspot.com/sdk: all simple-signaling.appspot.com
	cd simple-signaling.appspot.com && ln -s -f ../build/sdk .

.PHONY: all clean clean-all coverage docs integration lint publish serve test unit watch

node_modules: package.json
	@$(call INFO,"Installing node_modules")
	npm install && touch node_modules

$(BROWSERIFY): node_modules

$(JSDOC): node_modules

$(JSHINT): node_modules

$(MOCHA): node_modules

$(MOCHA_PHANTOMJS): node_modules

$(CLOSURE): node_modules

$(PUBLIC_DOCS): $(RELEASE_API_DOCS)
	@$(call INFO,"Symlinking public docs to release docs")
	mkdir -p $(PUBLIC_ROOT)
	cd $(PUBLIC_ROOT); ln -s -f ../releases/$(RELEASE_VERSION)/docs .

$(RELEASE_API_DOCS): $(JSDOC) $(LIB_FILES)
	@$(call INFO,"Generating release docs")
	$(JSDOC) $(PUBLIC_LIB_FILES) -d $(RELEASE_API_DOCS) -c ${JSDOC_CONF} && touch $(RELEASE_API_DOCS)
	./scripts/remove-private-constructors.js $(RELEASE_API_DOCS)
	./scripts/prefix-public-constructors.js $(RELEASE_API_DOCS)
	./scripts/prefix-static-methods.js $(RELEASE_API_DOCS)
	./scripts/reorder-navigation.js $(RELEASE_API_DOCS)

$(JS): $(PUBLIC_JS)
	@$(call INFO,"Symlinking public JavaScript")
	mkdir -p $(ROOT)/$(PUBLIC_VERSION)
	cd $(ROOT)/$(PUBLIC_VERSION); ln -s -f ../conversations/$(PUBLIC_VERSION)/$(PRODUCT).js

$(MIN_JS): $(PUBLIC_MIN_JS)
	@$(call INFO,"Symlinking minified public JavaScript")
	mkdir -p $(ROOT)/$(PUBLIC_VERSION)
	cd $(ROOT)/$(PUBLIC_VERSION); ln -s -f ../conversations/$(PUBLIC_VERSION)/$(PRODUCT).min.js

$(PUBLIC_JS): $(RELEASE_JS)
	@$(call INFO,"Symlinking release JavaScript")
	mkdir -p $(PUBLIC_ROOT)
	cd $(PUBLIC_ROOT); ln -s -f ../releases/$(RELEASE_VERSION)/$(PRODUCT).js .

$(PUBLIC_MIN_JS): $(RELEASE_MIN_JS)
	@$(call INFO,"Symlinking minified release JavaScript")
	mkdir -p $(PUBLIC_ROOT)
	cd $(PUBLIC_ROOT); ln -s -f ../releases/$(RELEASE_VERSION)/$(PRODUCT).min.js .

$(LATEST_JS): $(JS)
	@$(call INFO,"Symlinking latest JavaScript")
	mkdir -p $(ROOT)/latest
	cd $(ROOT)/latest; ln -s -f ../$(PUBLIC_VERSION)/twilio-rtc-conversations.js

$(LATEST_MIN_JS): $(MIN_JS)
	@$(call INFO,"Symlinking latest minified JavaScript")
	mkdir -p $(ROOT)/latest
	cd $(ROOT)/latest; ln -s -f ../$(PUBLIC_VERSION)/twilio-rtc-conversations.min.js

$(RELEASE_JS): $(BROWSERIFY) $(LIB_FILES) $(SRC_FILES) .LINTED .UNIT_TESTED .INTEGRATION_TESTED
	@$(call INFO,"Building release")
	@mkdir -p $(RELEASE_ROOT)
	echo "/** @license" >$(RELEASE_JS)
	echo "$(PRODUCT).js $(PUBLIC_VERSION) ($(RELEASE_VERSION))" >>$(RELEASE_JS)
	echo >>$(RELEASE_JS)
	cat LICENSE >>$(RELEASE_JS)
	echo "*/" >>$(RELEASE_JS)
	SDK_VERSION=$(RELEASE_VERSION) $(BROWSERIFY) src/$(PRODUCT).js >>$(RELEASE_JS)

$(RELEASE_MIN_JS): $(CLOSURE) $(RELEASE_JS)
	@$(call INFO,"Minifying release")
	$(CLOSURE) $(RELEASE_JS) --language_in=ECMASCRIPT5 >$(RELEASE_MIN_JS)

.LINTED: $(JSHINT) $(LIB_FILES) $(SRC_FILES) $(TEST_FILES)
	@if [[ -z "${SKIP_LINT}" ]]; then \
		$(call INFO,"Linting"); \
		make lint && touch .LINTED; \
	else \
		$(call INFO,"Skipped linting"); \
	fi

.INTEGRATION_TESTED: $(MOCHA) $(LIB_FILES) $(INTEGRATION_TEST_FILES)
	@if [[ -z "${SKIP_TEST}" && -z "${SKIP_INTEGRATION_TEST}" ]]; then \
		$(call INFO,"Running integration tests"); \
		make integration && touch $@; \
	else \
		$(call INFO,"Skipped integration tests"); \
	fi

.UNIT_TESTED: $(MOCHA) $(LIB_FILES) $(UNIT_TEST_FILES)
	@if [[ -z "${SKIP_TEST}" && -z "${SKIP_UNIT_TEST}" ]]; then \
		$(call INFO,"Running unit tests"); \
		make unit && touch $@; \
	else \
		$(call INFO,"Skipped unit tests"); \
	fi
