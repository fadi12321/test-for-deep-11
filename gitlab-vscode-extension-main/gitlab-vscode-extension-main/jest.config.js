// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

module.exports = {
  preset: 'ts-jest',
  clearMocks: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  coverageReporters: ['lcov', 'text'],
  roots: ['src'],
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'reports',
        outputName: 'unit.xml',
        titleTemplate: '{title}',
        classNameTemplate: '{classname}',
      },
    ],
  ],
  testPathIgnorePatterns: ['/node_modules/', '/src/webview/'],
  testEnvironment: 'node',
};
