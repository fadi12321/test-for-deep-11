const path = require('path');
const Mocha = require('mocha');
// glob is available in the VS Code runtime
// eslint-disable-next-line import/no-extraneous-dependencies
const glob = require('glob');
const { initializeTestEnvironment } = require('./test_infrastructure/initialize_test_environment');
const { validateTestEnvironment } = require('./test_infrastructure/validate_test_environment');

const getAllTestFiles = testsRoot =>
  new Promise((resolve, reject) => {
    glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
      if (err) reject(err);
      resolve(files);
    });
  });

/**
 * Windows is not case sensitive when accessing files, but node is. For some reason, __dirname which
 * is used by `require()` for resolving modules contains a lower case drive letter (e.g. c:\\workspace\extension\tests)
 * but the testsRoot passed in by VS Code contains upper case drive letter (e.g. C:\\workspace\extension\tests).
 *
 * This causes the singleton module initialization to initialize different modules than the ones that are used by tests.
 */
const ensureLowerCaseDriveLetter = path => {
  const [drive, ...rest] = path;
  return `${drive.toLowerCase()}${rest.join('')}`;
};

async function run(testsRoot) {
  require('source-map-support').install(); // eslint-disable-line global-require

  try {
    validateTestEnvironment();

    const isWin = process.platform === 'win32';
    // Create the mocha test
    const mocha = new Mocha();
    mocha.timeout(isWin ? 10000 : 3000); // It takes longer to run the test on windows CI runners
    mocha.color(true);

    const winFriendlyTestsRoot = ensureLowerCaseDriveLetter(testsRoot);
    const files = await getAllTestFiles(winFriendlyTestsRoot);

    // Add files to the test suite
    files.forEach(f => mocha.addFile(path.resolve(winFriendlyTestsRoot, f)));

    // Initialize VS Code environment for integration tests
    await initializeTestEnvironment(winFriendlyTestsRoot);

    // Run the mocha test
    await new Promise((res, rej) =>
      // eslint-disable-next-line no-promise-executor-return
      mocha.run(failures => {
        if (failures) {
          rej(failures);
        } else {
          res();
        }
      }),
    );
  } catch (e) {
    // temporary fix for https://github.com/microsoft/vscode/issues/123882
    console.error(e);
    throw e;
  }
}

module.exports = { run };
