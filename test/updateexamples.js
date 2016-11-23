var path = require('path');
var fs = require('fs');
var expect = require('expect.js');
var Git = require('node-git-simple');
var runTask = require('grunt-run-task');

describe('Update Working Examples', function () {
	var rootPath = './test/actual/updateexamples',
		corePath = path.join(rootPath, 'core'),
		distPath = path.join(rootPath, 'dist'),
		examplesPath = path.join(process.cwd(), rootPath, 'examples'),
		coreRepo, distRepo, cloneRepo, callback, testFile, cwd;

	var error = function(error) {
		if (callback) {
			callback(error);
		}
		throw error;
	};

	before(function(done){
		callback = done;

		cwd = process.cwd();

		fs.mkdirSync(rootPath);
		fs.mkdirSync(corePath);
		fs.mkdirSync(distPath);

		Git.create(corePath, true)
		.then(function(repo){
			coreRepo = repo;
			return Git.create(distPath, true);
		}, error)
		.then(function(repo) {
			distRepo = repo;
			return Git.clone(rootPath, coreRepo.cwd, 'clone');
		}, error)
		.then(function(repo) {
			cloneRepo = repo;
			testFile = path.join(repo.cwd, 'test');
			fs.writeFileSync(testFile, 'test');
		}, error)
		.then(function() {
			return cloneRepo.exec('add', '.');
		}, error)
		.then(function() {
			return cloneRepo.exec('commit', '-m', 'Initial commit');
		}, error)
		.then(function(repo) {
			return cloneRepo.exec('push', distRepo.cwd, 'master');
		}, error)
		.then(function() {
			done();
		}, error);
	});

	after(function() {
		process.chdir(cwd);
	});

	describe('Configuration', function() {
		it('Fails if no message is specified', function(done) {
			var task = runTask.task('wb-update-examples', {
				all: {}
			});

			task.run(function(err){
				try{
					expect(err).to.not.be(undefined);
					expect(err).to.be('Mandatory option \'message\' not found.');
					done();
				} catch (err) {
					return done(err);
				}
			});
		});

        it('Displays the underlying error if silent is not \'true\'', function(done) {
			var task = runTask.task('wb-update-examples', {
				all: {
					options: {
						repo: 'http://badurl.not',
						message: 'Message',
					}
				}
			});

			task.run(function(err){
				try{
					expect(err).to.not.be(undefined);
					expect(err).to.not.be('Unspecified error (run without silent option for detail)');
					done();
				} catch (err) {
					return done(err);
				}
			});
		});

		it('Displays a generic error if the silent option is \'true\'', function(done) {
			var task = runTask.task('wb-update-examples', {
				all: {
					options: {
						repo: 'http://badurl.not',
						message: 'Message',
						silent: true
					}
				}
			});

			task.run(function(err){
				try{
					expect(err).to.not.be(undefined);
					expect(err).to.be('Unspecified error (run without silent option for detail)');
					done();
				} catch (err) {
					return done(err);
				}
			});
		});
	});

	describe('Same Repo', function() {
		var message = 'Updated examples in origin repo',
			branch = 'gh-pages',
			commit, task;

		before(function(done) {
			this.timeout(9000);
			callback = done;

			cloneRepo.exec('checkout', '--orphan', branch)
			.then(function(){
				return cloneRepo.exec('rm', '-rf', '.');
			})
			.then(function() {
				return cloneRepo.exec('submodule', 'add', distRepo.cwd, 'dist');
			}, error)
			.then(function() {
				return cloneRepo.exec('add', '.');
			}, error)
			.then(function() {
				return cloneRepo.exec('commit', '-m', 'Added submodule');
			}, error)
			.then(function() {
				return cloneRepo.exec('push', coreRepo.cwd, branch);
			}, error)
			.then(function() {
				return cloneRepo.exec('checkout', 'master');
			}, error)
			.then(function() {
				fs.writeFileSync(testFile, 'test2');
				return cloneRepo.exec('add', '.');
			}, error)
			.then(function() {
				return cloneRepo.exec('commit', '-m', 'Changed file');
			}, error)
			.then(function() {
				return cloneRepo.exec('rev-parse', 'master');
			})
			.then(function() {
				commit = cloneRepo.lastCommand.stdout.replace('\n', '');
				return cloneRepo.exec('push', distRepo.cwd, 'master');
			}, error)
			.then(function() {
				task = runTask.task('wb-update-examples', {
					all: {
						options: {
							message: message
						}
					}
				});

				task.grunt.file.setBase(cloneRepo.cwd);

				task.run(function(err){
					if (err) {
						return done(err);
					}
					done();
				});
			}, error);

		});

		it('Updated the submodules', function(done){
			callback = done;

			coreRepo.exec('log', branch + '~1..' + branch)
			.then(function(repo) {
				expect(repo.lastCommand.stdout).to.contain(message);
				return repo.exec('ls-tree', branch);
			}, error)
			.then(function(repo) {
				expect(repo.lastCommand.stdout).to.contain('commit ' + commit);
				done();
			}, error)
			.then(null, error);
		});

		it('Finishes sucessfully when submodules are already up to date', function(done) {
			task.run(function(err) {
				try{
					expect(err).to.be(undefined);
					done();
				} catch (err) {
					done(err);
				}
			});
		});
	});

	describe('External Repo', function(done) {
		var message = 'Updated examples in other repo',
			branch = 'master',
			commit, examplesRepo, task;

		before(function(done) {
			this.timeout(9000);

			fs.mkdirSync(examplesPath);

			Git.create(examplesPath, true)
			.then(function(repo) {
				examplesRepo = repo;
				return coreRepo.exec('push', examplesRepo.cwd, 'gh-pages:' + branch);
			}, error)
			.then(function() {
				fs.writeFileSync(testFile, 'test3');
				return cloneRepo.exec('add', '.');
			}, error)
			.then(function(){
				return cloneRepo.exec('commit', '-m', 'My commit');
			}, error)
			.then(function() {
				return cloneRepo.exec('rev-parse', 'master');
			})
			.then(function(repo){
				commit = cloneRepo.lastCommand.stdout.replace('\n', '');
				return cloneRepo.exec('push', distRepo.cwd, 'master');
			}, error)
			.then(function() {
				task = runTask.task('wb-update-examples', {
					all: {
						options: {
							message: message,
							repo: examplesRepo.cwd,
							branch: branch
						}
					}
				});

				task.grunt.file.setBase(cloneRepo.cwd);

				task.run(function(err){
					if (err) {
						return done(err);
					}
					done();
				});
			}, error);

		});

		after(function() {
			process.cwd(cloneRepo.cwd);
		});

		it('Updated the submodules', function(done){
			callback = done;

			examplesRepo.exec('log', branch + '~1..' + branch)
			.then(function(repo) {
				expect(repo.lastCommand.stdout).to.contain(message);
				return repo.exec('ls-tree', branch);
			}, error)
			.then(function(repo) {
				expect(repo.lastCommand.stdout).to.contain('commit ' + commit);
				done();
			}, error)
			.then(null, error);
		});

		it('Finishes sucessfully when submodules are already up to date', function(done) {
			task.run(function(err) {
				try{
					expect(err).to.be(undefined);
					done();
				} catch (err) {
					done(err);
				}
			});
		});

		it.skip('Updates examples if a clone already exist', function(done) {
			//TODO: Implement test
		});
	});
});
