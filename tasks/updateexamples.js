var Git = require('node-git-simple');

module.exports = function(grunt) {

	var callback, silent;

	function errorLog(error) {
		var message;

		if (!silent) {
			message = error;
		} else {
			message = 'Unspecified error (run without silent option for detail)';
		}
		grunt.fail.warn(message);
		callback(false);
	}

	function updateExample(repo, options, done) {
		var branch = options.branch || 'gh-pages',
			oldBranch;

		repo.exec('branch')
		.then(function(repo) {
			oldBranch = repo.lastCommand.stdout.match(/\*\s*([^\n]*)/)[1];
			return repo.exec('checkout', branch);
		}, errorLog)
		.then(function(repo) {
			return repo.exec('submodule', 'update', '--remote', '--init');
		}, errorLog)
		.then(function(repo){
			return repo.exec('add', '.');
		}, errorLog)
		.then(function(repo){
			return repo.exec('commit', '-m', options.message);
		}, errorLog)
		.then(function(repo){
			return repo.exec('push', 'origin', branch);
		}, errorLog)
		.then(function() {
			return repo.exec('checkout', oldBranch);
		})
		.then(function(){
			done();
		});

	}

	grunt.registerMultiTask('wb-update-examples', 'Update working examples', function () {
		var options = this.options(),
			done;

		if (!options.message){
			return grunt.fail.warn('Mandatory option \'message\' not found.');
		}

		done = this.async();
		callback = done;

		silent = options.silent;

		if (options.repo) {
			Git.clone(process.cwd(), options.repo)
			.then(function(repo) {
				return updateExample(repo, options, done);
			}, errorLog);
		} else {
			return updateExample(new Git(process.cwd()), options, done);
		}
	});
};
