all:
	npm install
	./node_modules/gulp/bin/gulp.js

publish: www/twilio_credentials.json
	cd www
	virtualenv venv
	bash -c 'source venv/bin/activate; pip install twilio'
	rm -f httplib2 six.py twilio
	ln -s venv/lib/python2.7/site-packages/httplib2 .
	ln -s venv/lib/python2.7/site-packages/six.py .
	ln -s venv/lib/python2.7/site-packages/twilio .
	appcfg.py update . --oauth2
	cd ..
