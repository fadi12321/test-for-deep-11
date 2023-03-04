#!/usr/bin/env node

// This script creates a temporary workspace that can be used for debugging integration tests
const { readFileSync, writeFileSync } = require('fs');
const path = require('path');
const { default: createTmpWorkspace } = require('../out/test/create_tmp_workspace'); // eslint-disable-line import/extensions

const PLACEHOLDER = `<run \`npm run create-test-workspace\` to generate a test folder>`;

createTmpWorkspace(false).then(workspaceFolder => {
  const launchPath = path.resolve(__dirname, '../.vscode/launch.json');
  const tasksContent = readFileSync(launchPath, 'UTF-8');
  const tasks = tasksContent.replace(PLACEHOLDER, workspaceFolder);
  writeFileSync(launchPath, tasks);
});
