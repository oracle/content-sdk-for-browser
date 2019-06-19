/**
 * Copyright (c) 2019 Oracle and/or its affiliates. All rights reserved.
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
/* global console, __dirname, process, console */
/* jshint esversion: 6 */

var gulp = require('gulp'),
	path = require('path'),
	fs = require('fs'),
	fse = require('fs-extra');

var projectDir = path.join(__dirname, "..");
var libsDir = path.join(projectDir, 'libs');

/**
 * Copy the configured libraries from node_modules into library folder
 */
gulp.task('copy-libs', function (done) {
	'use strict';

	if (!fs.existsSync(libsDir)) {
		fs.mkdirSync(libsDir);
	}
	var libs = ['jquery/dist/jquery.min.js', 'jquery/dist/jquery.js',
		'marked/lib/marked.js', 'marked/marked.min.js',
		'mustache/mustache.min.js', 'mustache/mustache.js',
		'requirejs/require.js',
		'require-css/css.min.js', 'require-css/css.js'
	];
	for (var i = 0; i < libs.length; i++) {
		var src = path.join(projectDir, 'node_modules', libs[i]);
		var name = libs[i];
		name = name.substring(name.lastIndexOf('/') + 1);
		var dest = path.join(libsDir, name);
		console.log('Copying node_modules/' + libs[i] + ' to libs/' + name);
		fse.copySync(src, dest);
	};

	done();
});