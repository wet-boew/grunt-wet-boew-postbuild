var path = require('path');
var Git = require('node-git-simple');

module.exports = function(grunt) {

	var callback, silent, feedback;

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
			if (oldBranch === branch) {
				return repo.exec('pull', 'origin', branch);
			} else {
				return repo.exec('fetch', '-f', 'origin', branch + ':' + branch);
			}
		}, errorLog)
		.then(function(repo) {
			return repo.exec('checkout', branch);
		}, errorLog)
		.then(function(repo) {
			var promise = repo.exec('submodule', 'update', '--remote', '--init');

			/* Travis CI cancels the build if no output is sent in a specific
			 * time. Add some feedback that the task is still going.
			 */
			 if (silent) {
				 feedback = setInterval(function() {
					 grunt.log.write('.');
				 }, 30000);
			 }

			 return promise;
		}, function(error) {
			clearInterval(feedback);
		})
		.then(function(repo){
			clearInterval(feedback);

			return repo.exec('status');
		})
		.then(function(repo){
			if (!repo.lastCommand.stdout.match(/nothing to commit/)) {
				return repo.exec('add', '.');
			}
		}, errorLog)
		.then(function(repo){
			if (repo) {
				return repo.exec('commit', '-m', options.message);
			}
		}, errorLog)
		.then(function(repo){
			if (repo) {
				return repo.exec('push', 'origin', branch);
			}
		}, errorLog)
		.then(function() {
			if (repo) {
				return repo.exec('checkout', oldBranch);
			}
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
			}, function(err) {
				var matches = err.stderr.match(/destination path '(.*)' already exists/),
					gitPath;

				if (matches) {
					gitPath = path.join(process.cwd(), matches[1]);
					return updateExample(new Git(gitPath), options, done);
				}
				errorLog(err);
			});
		} else {
			return updateExample(new Git(process.cwd()), options, done);
		}
	});
};
