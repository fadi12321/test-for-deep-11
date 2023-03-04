const testSnippet1 = {
  id: 'gid://gitlab/ProjectSnippet/111',
  projectId: 'gid://gitlab/Project/278964',
  title: 'Test snippet',
  description: 'test description',
  blobs: {
    nodes: [
      {
        name: 'test.js',
        path: 'test.js',
        rawPath: '/gitlab-org/gitlab-vscode-extension/-/snippets/111/raw/master/test.js',
      },
    ],
  },
};

const testSnippet2 = {
  id: 'gid://gitlab/ProjectSnippet/222',
  projectId: 'gid://gitlab/Project/278964',
  title: 'Test snippet',
  description: 'test description',
  blobs: {
    nodes: [
      {
        name: 'test1.js',
        path: 'test1.js',
        rawPath: '/gitlab-org/gitlab-vscode-extension/-/snippets/222/raw/main/test1.js',
      },
      {
        name: 'test2.js',
        path: 'test2.js',
        rawPath: '/gitlab-org/gitlab-vscode-extension/-/snippets/222/raw/main/test2.js',
      },
    ],
  },
};

const patchSnippet = {
  id: 'gid://gitlab/ProjectSnippet/333',
  projectId: 'gid://gitlab/Project/278964',
  title: 'test suggestions',
  description: '',
  blobs: {
    nodes: [
      {
        name: 'test suggestion.patch',
        path: 'test suggestion.patch',
        rawPath:
          '/gitlab-org/gitlab-vscode-extension/-/snippets/333/raw/main/test suggestion.patch',
      },
    ],
  },
};

const snippetsResponse = {
  project: {
    id: 'gid://gitlab/Project/278964',
    snippets: {
      nodes: [testSnippet1, testSnippet2],
    },
  },
};

const snippetWithOneBlobResponse = {
  snippets: {
    nodes: [
      {
        blobs: {
          nodes: [
            {
              path: 'test.js',
              rawPlainData: 'snippet content',
            },
          ],
        },
      },
    ],
  },
};

const snippetWithTwoBlobsResponse = {
  snippets: {
    nodes: [
      {
        blobs: {
          nodes: [
            {
              path: 'test1.js',
              rawPlainData: 'snippet content',
            },
            {
              path: 'test2.js',
              rawPlainData: 'second blob content',
            },
          ],
        },
      },
    ],
  },
};

module.exports = {
  testSnippet1,
  testSnippet2,
  patchSnippet,
  snippetsResponse,
  snippetWithOneBlobResponse,
  snippetWithTwoBlobsResponse,
};
