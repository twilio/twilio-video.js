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
ALL= \
	$(PUBLIC_LOADER) \
	$(PUBLIC_LOADER_MIN) \
	$(RELEASE_LOADER) \
	$(RELEASE_LOADER_MIN) \
	$(REALEASE) \
	$(RELEASE_MIN) \
	$(PUBLIC_DOCS) \
	$(RELEASE_DOCS)

# Sources
LIB_FILES=$(shell find lib -name \*.js)
SRC_FILES=$(shell find src -name \*.js)
TEST_FILES=$(shell find test -name \*.js)

# Public APIs (we generate JSDoc for these)
PUBLIC_LIB_FILES= \
	lib/accesstoken.js \
	lib/conversation.js \
	lib/endpoint.js \
	lib/invite.js \
	lib/media/index.js \
	lib/media/track.js \
	lib/participant.js

# Tools
BROWSERIFY=node_modules/browserify/bin/cmd.js
JSDOC=node_modules/jsdoc/jsdoc.js
JSHINT=node_modules/jshint/bin/jshint
MOCHA=node_modules/mocha/bin/mocha
MOCHA_PHANTOMJS=node_modules/mocha-phantomjs/bin/mocha-phantomjs
CLOSURE=node_modules/closurecompiler/bin/ccjs

INFO=echo "\033[1;34m[$$(date "+%H:%M:%S")] $(1)\033[0m"

all: $(ALL)

clean:
	rm -rf build .LINTED .TESTED

clean-all: clean

docs:
	@$(call INFO,"Generating docs")
	$(JSDOC) $(PUBLIC_LIB_FILES) -d $(RELEASE_DOCS) && touch $(RELEASE_DOCS)
	./scripts/remove-private-constructors.js $(RELEASE_DOCS)
	./scripts/prefix-public-constructors.js $(RELEASE_DOCS)
	./scripts/prefix-static-methods.js $(RELEASE_DOCS)
	./scripts/reorder-navigation.js $(RELEASE_DOCS)

lint: node_modules
	$(JSHINT) $(LIB_FILES) $(SRC_FILES) --reporter node_modules/jshint-stylish/stylish.js

patch:	node_modules
	@$(call INFO,"Patching SIP.js")
	@patch -N node_modules/sip.js/src/SanityCheck.js \
		<patch/disable_rfc3261_18_1_2.patch; true; \
	patch -N node_modules/sip.js/src/Hacks.js \
		<patch/disable_masking.patch; true; \
	patch -N node_modules/sip.js/src/Session.js \
		<patch/refer.patch; true; \
	patch -N node_modules/sip.js/src/Transactions.js \
		<patch/always_send_cancel.patch; true; \
	patch -N node_modules/sip.js/src/Grammar/dist/Grammar.js \
		<patch/disable_lowercasing_host.patch; true; \
	patch -N node_modules/sip.js/src/Session.js \
		<patch/enable_reinvite_support.patch; true; \
	patch -N node_modules/sip.js/src/WebRTC/MediaHandler.js \
		<patch/renegotiation.patch; true

publish: simple-signaling.appspot.com
	cd simple-signaling.appspot.com && make publish

release-version:
	@echo $(RELEASE_VERSION)

serve: simple-signaling.appspot.com/sdk
	cd simple-signaling.appspot.com && make serve

test: test.json
	$(MOCHA) --reporter=spec test/spec/index.js

test.json:
	@if [ ! -f test.json ]; then \
		echo "\n\nYou need to create \`test.json'."; \
		echo "See \`test.json.example'.\n\n"; \
		exit 1; \
	fi

simple-signaling.appspot.com:
	git submodule init
	git submodule update

simple-signaling.appspot.com/sdk: all simple-signaling.appspot.com
	cd simple-signaling.appspot.com && ln -s -f ../build/sdk .

.PHONY: all clean clean-all docs lint patch publish serve test

node_modules: package.json
	@$(call INFO,"Installing node_modules")
	npm install && touch node_modules
	make patch

$(BROWSERIFY): node_modules

$(JSDOC): node_modules

$(JSHINT): node_modules

$(MOCHA): node_modules

$(MOCHA_PHANTOMJS): node_modules

$(CLOSURE): node_modules

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
	./scripts/prefix-private-constructors.js $(RELEASE_DOCS)
	./scripts/prefix-static-methods.js $(RELEASE_DOCS)
	./scripts/reorder-navigation.js $(RELEASE_DOCS)

$(RELEASE_LOADER): $(RELEASE)
	@$(call INFO,"Symlinking release loader to release")
	(cd $(RELEASE_ROOT); ln -s -f $(PRODUCT).js $(PRODUCT)-loader.js)

$(RELEASE_LOADER_MIN): $(RELEASE_MIN)
	@$(call INFO,"Symlinking minified release loader to minified release")
	(cd $(RELEASE_ROOT); ln -s -f $(PRODUCT).min.js $(PRODUCT)-loader.min.js)

$(RELEASE): $(BROWSERIFY) $(LIB_FILES) $(SRC_FILES) .LINTED .TESTED
	@$(call INFO,"Building release")
	@mkdir -p $(RELEASE_ROOT)
	$(BROWSERIFY) src/$(PRODUCT).js -o $(RELEASE)

$(RELEASE_MIN): $(CLOSURE) $(RELEASE)
	@$(call INFO,"Minifying release")
	$(CLOSURE) $(RELEASE) --language_in=ECMASCRIPT5 >$(RELEASE_MIN)

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
