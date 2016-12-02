var path = require('path');
var Git = require('node-git-simple');

module.exports = function(grunt) {

	function updateExample(repo, options) {
		var feedback = setInterval(function() {
				grunt.log.write('.');
			}, 30000);

		return repo.exec('submodule', 'update', '--remote', '--init')
		.then(function(repo){
			if(repo) {
				return repo.exec('status');
			}
		})
		.then(function(repo){
			if (repo && !repo.lastCommand.stdout.match(/nothing to commit/)) {
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
				return repo.exec('push', 'origin', options.branch);
			}
		})
		.then(function(){
			clearInterval(feedback);
		});
	}

	function updateExampleLocal(repo, options) {
		var branch = options.branch,
			oldBranch;

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
			return updateExample(repo, options);
		})
		.then(function() {
			if (oldBranch !== branch) {
				repo.exec('checkout', oldBranch);
			}
		});
	}

	grunt.registerMultiTask('wb-update-examples', 'Update working examples', function () {
		var options = this.options(),
			silent = options.silent || false,
			errorLog = function(error) {
				if (silent) {
					error = new Error('Unspecified error (run without silent option for detail)');
				}
				grunt.fail.warn(error.message);
			},
			done;

		options.branch = options.branch || 'gh-pages';

		if (!options.message){
			return grunt.fail.warn('Mandatory option \'message\' not found.');
		}

		done = this.async();

		if (options.repo) {
			Git.clone(process.cwd(), options.repo, ['--single-branch', '--branch', options.branch])
			.fail(function(err) {
				var matches, gitPath;
				if (err.stderr) {
					matches = err.stderr.match(/destination path '(.*)' already exists/);
					if (matches) {
						gitPath = path.join(process.cwd(), matches[1]);
						return new Git(gitPath);
					}
				}
				errorLog(err);
			})
			.then(function(repo) {
				if (repo) {
					return updateExample(repo, options);
				}
			})
			.then(done)
			.fail(errorLog);
		} else {
			updateExampleLocal(new Git(process.cwd()), options)
			.then(done)
			.fail(errorLog);
		}
	});
};
