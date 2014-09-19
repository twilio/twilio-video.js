module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    meta: {
      banner: '\
/*\n\
 * twilio-simple-signaling.js version <%= pkg.version %>\n\
 * Copyright (c) 2014-<%= grunt.template.today("yyyy") %> Twilio, Inc <https://twilio.com>\n\
 * Homepage: https://twilio.com\n\
 */\n\n\n'
    },
    browserify: {
      dist: {
        src: 'src/browser.js',
        dest: 'dist/<%= pkg.name %>.js',
        files: {
          'dist/<%= pkg.name %>.js': ['src/*.js']
        }
      },
      devel: {
        src: 'src/browser.js',
        dest: 'dist/<%= pkg.name %>-<%= pkg.version %>.js',
        files: {
          'dist/<%= pkg.name %>.js': ['src/*.js']
        }
      }
    },
    jshint: {
      dist: 'src/*.js', // 'dist/<%= pkg.name %>.js',
      devel: 'src/*.js', // 'dist/<%= pkg.name %>-<%= pkg.version %>.js',
      options: {
        '-W079': true,
        browser: true,
        curly: true,
        eqeqeq: true,
        immed: true,
        latedef: 'nofunc',
        laxbreak: true,
        loopfunc: true,
        newcap: false,
        noarg: true,
        sub: true,
        undef: true,
        boss: true,
        eqnull: true,
        onecase: true,
        unused: true,
        supernew: true,
        globals: {
          module: true,
          define: true,
          global: true,
          require: true,
          console: true,
          Buffer: true
        }
      }
    },
    shell: {
      options: {
        stdout: true,
        stderr: true
      },
      unit: {
        command: './node_modules/mocha/bin/mocha --reporter spec test/unit/*.js'
      },
      functional: {
        command: './node_modules/mocha/bin/mocha --reporter spec test/functional/*.js'
      }
    },
    uglify: {
      dist: {
        files: {
          'dist/<%= pkg.name %>.min.js': ['dist/<%= pkg.name %>.js']
        }
      },
      devel: {
        files: {
	  'dist/<%= pkg.name %>-<%= pkg.version %>.min.js': ['dist/<%= pkg.name %>-<%= pkg.version %>.js']
        }
      },
      options: {
        banner: '<%= meta.banner %>'
      }
    }
  });


  // Load Grunt plugins.
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-shell');

  grunt.registerTask('build', ['browserify:devel', 'jshint:devel', 'browserify:dist', 'jshint:dist', 'uglify:dist', 'uglify:devel']);
  grunt.registerTask('devel', ['browserify:devel', 'jshint:devel']);
  grunt.registerTask('quick', ['browserify:dist']);

  // Test tasks.
  grunt.registerTask('unit', ['shell:unit']);
  grunt.registerTask('functional', ['shell:functional']);
  grunt.registerTask('test', ['unit', 'functional']);

  // Default task is an alias for 'build'.
  grunt.registerTask('default', ['build', 'test']);

};
