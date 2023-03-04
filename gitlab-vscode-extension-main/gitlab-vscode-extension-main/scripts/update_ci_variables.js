const fs = require('fs');
const path = require('path');
const fetch = require('cross-fetch');

const VARIABLE_JSON_PATH = path.join(__dirname, '../src/completion/ci_variables.json');

const docsLinkBasePath = 'https://gitlab.com/gitlab-org/gitlab/-/blob/master/doc/ci/variables/';

async function fetchDocumentation() {
  return fetch(
    'https://gitlab.com/gitlab-org/gitlab/-/raw/master/doc/ci/variables/predefined_variables.md',
  ).then(res => res.text());
}

const headerLineRegex = /^\|\s+Variable/;
const dividerLineRegex = /^\|-+/;
const tableLineRegex = /^\|.+\|.+\|.+\|.+\|$/;
const descriptionLinkRegex = /\]\((?!https?:\/\/)([^)]+)\)/;

function parseDocumentation(variableMarkdown) {
  const lines = variableMarkdown.split('\n');
  const tableLines = lines.filter(l => l.match(tableLineRegex));
  const tableLinesWithoutHeaders = tableLines.filter(
    l => !l.match(headerLineRegex) && !l.match(dividerLineRegex),
  );
  const variables = tableLinesWithoutHeaders.map(l => {
    const [, nameSegment, , , descriptionSegment] = l.split('|');

    if (!nameSegment) return undefined;

    const description = descriptionSegment
      .trim()
      .replace(descriptionLinkRegex, `](${docsLinkBasePath}$1)`);

    return {
      name: nameSegment.trim().replace(/`/g, ''),
      description,
    };
  });

  // avoid computing a difference based on order in the docs
  variables.sort((a, b) => (a.name < b.name ? -1 : 1));

  const json = JSON.stringify(variables.filter(Boolean), undefined, 2);
  return `${json}\n`;
}

function loadExistingVariablesJson() {
  return fs.readFileSync(VARIABLE_JSON_PATH).toString();
}

function writeVariablesJson(json) {
  return fs.writeFileSync(VARIABLE_JSON_PATH, json);
}

async function run() {
  const onlineDoc = await fetchDocumentation();
  const onlineVariablesJson = parseDocumentation(onlineDoc);
  const existingVariablesJson = loadExistingVariablesJson();

  if (process.env.CI && onlineVariablesJson !== existingVariablesJson) {
    console.error(
      '❌ ./src/utils/ci_variables.json has changed, go to https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/main/docs/developer/ci-variables.md.',
    );
    process.exit(1);
  }
  if (onlineVariablesJson !== existingVariablesJson) {
    writeVariablesJson(onlineVariablesJson);
    console.log('✅ ./src/utils/ci_variables.json was updated successfully.');
  } else {
    console.log('ℹ️ No changes to ./src/utils/ci_variables.json.');
  }
}

run();
