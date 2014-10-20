var fs = require('fs');
var rimraf = require('rimraf');

var actual = './test/actual';

require('./updateexamples');

before(function() {
	fs.mkdirSync(actual);
});

after(function(){
	rimraf.sync(actual);
});
