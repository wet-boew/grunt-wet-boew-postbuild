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
		coreRepo, distRepo, cloneRepo, cwd, testFile;

	before(function(done){
		cwd = process.cwd();

		fs.mkdirSync(rootPath);
		fs.mkdirSync(corePath);
		fs.mkdirSync(distPath);

		Git.create(corePath, true)
		.then(function(repo){
			coreRepo = repo;
			return Git.clone(rootPath, coreRepo.cwd, 'clone');
		})
		.then(function(repo) {
			cloneRepo = repo;
			testFile = path.join(repo.cwd, 'test');
			fs.writeFileSync(testFile, 'test');
		})
		.then(function() {
			return cloneRepo.exec('add', '.');
		})
		.then(function() {
			return cloneRepo.exec('commit', '-m', 'Initial commit');
		})
		.then(function() {
			return cloneRepo.exec('push', 'origin', 'master');
		})
		.then(function() {
			return Git.create(distPath, true);
		})
		.then(function(repo) {
			distRepo = repo;
			return cloneRepo.exec('push', distRepo.cwd, 'master:gh-pages');
		})
		.then(function() {
			done();
		})
		.fail(done);
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

			cloneRepo.exec('checkout', '--orphan', branch)
			.then(function(){
				return cloneRepo.exec('rm', '-rf', '.');
			})
			.then(function() {
				return cloneRepo.exec('submodule', 'add', '-b', branch, '-f', distRepo.cwd, 'dist');
			})
			.then(function() {
				return cloneRepo.exec('add', '.');
			})
			.then(function() {
				return cloneRepo.exec('commit', '-m', 'Added submodule');
			})
			.then(function() {
				return cloneRepo.exec('push', coreRepo.cwd, branch);
			})
			.then(function() {
				return cloneRepo.exec('checkout', 'master');
			})
			.then(function() {
				fs.writeFileSync(testFile, 'test2');
				return cloneRepo.exec('add', '.');
			})
			.then(function() {
				return cloneRepo.exec('commit', '-m', 'Changed file');
			})
			.then(function() {
				return cloneRepo.exec('rev-parse', 'master');
			})
			.then(function() {
				commit = cloneRepo.lastCommand.stdout.replace('\n', '');
				return cloneRepo.exec('push', distRepo.cwd, 'master');
			})
			.then(function() {
				task = runTask.task('wb-update-examples', {
					all: {
						options: {
							message: message
						}
					}
				});

				task.grunt.file.setBase(cloneRepo.cwd);
				task.run(done);
			})
			.fail(function(err) {
				console.log(err);
				done(err);
			});
		});

		it('Checks out the initial branch after completion', function(done) {
			cloneRepo.exec('branch')
			.then(function(repo) {
				var branch = repo.lastCommand.stdout.match(/\*\s*([^\n]*)/)[1];
				expect(branch).to.be('master');
				done();
			})
			.fail(done);
		});

		it('Updated the submodules', function(done){
			cloneRepo.exec('fetch', coreRepo.cwd, branch + ':test-local')
			.then(function(repo) {
				return repo.exec('checkout', 'test-local');
			})
			.then(function(repo){
				return repo.exec('submodule');
			})
			.then(function(repo) {
				expect(repo.lastCommand.stdout).to.contain(commit + ' dist');
				done();
			})
			.fail(done)
			.fin(function() {
				cloneRepo.exec('checkout', 'master');
			});
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
			})
			.then(function() {
				fs.writeFileSync(testFile, 'test3');
				return cloneRepo.exec('add', '.');
			})
			.then(function(){
				return cloneRepo.exec('commit', '-m', 'My commit');
			})
			.then(function() {
				return cloneRepo.exec('rev-parse', 'master');
			})
			.then(function(repo){
				commit = cloneRepo.lastCommand.stdout.replace('\n', '');
				return cloneRepo.exec('push', distRepo.cwd, 'master');
			})
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

				task.run(done);
			})
			.fail(done);

		});

		after(function() {
			process.cwd(cloneRepo.cwd);
		});

		it('Updated the submodules', function(done){
			cloneRepo.exec('fetch', examplesRepo.cwd, branch + ':test-remote')
			.then(function(repo) {
				return repo.exec('checkout', 'test-remote');
			})
			.then(function(repo) {
				return repo.exec('submodule');
			})
			.then(function(repo) {
				expect(repo.lastCommand.stdout).to.contain(commit);
				done();
			})
			.fail(done)
			.fin(function() {
				cloneRepo.exec('checkout', 'master');
			});
		});

		it('Finishes sucessfully when submodules are already up to date', function(done) {
			task.run(done);
		});

		it.skip('Updates examples if a clone already exist', function(done) {
			//TODO: Implement test
		});
	});
});
