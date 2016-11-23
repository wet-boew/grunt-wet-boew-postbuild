var path = require('path');
var Git = require('node-git-simple');

module.exports = function(grunt) {

	function updateExample(repo, options) {
		var branch = options.branch || 'gh-pages',
			oldBranch, feedback;

		return repo.exec('branch')
		.then(function(repo) {
			oldBranch = repo.lastCommand.stdout.match(/\*\s*([^\n]*)/)[1];
			if (oldBranch === branch) {
				return repo.exec('pull', 'origin', branch);
			} else {
				return repo.exec('fetch', '-f', 'origin', branch + ':' + branch);
			}
		})
		.then(function(repo) {
			return repo.exec('checkout', branch);
		})
		.then(function(repo) {
			var promise = repo.exec('submodule', 'update', '--remote', '--init');
			feedback = setInterval(function() {
				grunt.log.write('.');
			}, 30000);

			 return promise;
		})
		.then(function(repo){
			return repo.exec('status');
		})
		.then(function(repo){
			if (!repo.lastCommand.stdout.match(/nothing to commit/)) {
				return repo.exec('add', '.');
			} else {
				return null;
			}
		})
		.then(function(repo){
			if (repo) {
				return repo.exec('commit', '-m', options.message);
			}
		})
		.then(function(repo){
			if (repo) {
				return repo.exec('push', 'origin', branch);
			}
		})
		.then(function() {
			if (repo) {
				return repo.exec('checkout', oldBranch);
			}
		})
		.then(function(){
			return true;
		})
		.fin(function(){
			clearInterval(feedback);
		});

	}

	grunt.registerMultiTask('wb-update-examples', 'Update working examples', function () {
		var options = this.options(),
			errorLog = function(error) {
				var message;

				if (!options.silent) {
					message = error;
				} else {
					message = 'Unspecified error (run without silent option for detail)';
				}
				grunt.fail.warn(message);
			},
			done;

        options.branch = options.branch || 'gh-pages';

		if (!options.message){
			return grunt.fail.warn('Mandatory option \'message\' not found.');
		}

		done = this.async();

		if (options.repo) {
			Git.clone(process.cwd(), options.repo, ['--single-branch', '--branch', options.branch])
			.then(function(repo) {
				return updateExample(repo, options);

			}, function(err) {
				var matches = err.stderr.match(/destination path '(.*)' already exists/),
					gitPath;

				if (matches) {
					gitPath = path.join(process.cwd(), matches[1]);
					return updateExample(new Git(gitPath), options, done);
				}
				errorLog(err);
				done(false);
			})
			.fail(errorLog)
			.done(done);
		} else {
			updateExample(new Git(process.cwd()), options)
			.fail(errorLog)
			.done(done);
		}
	});
};
