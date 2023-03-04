const systemNote = {
  replyId: 'gid://gitlab/IndividualNoteDiscussion/3e120050b42400665aa728f283cfa167d800f03e',
  createdAt: '2020-12-02T09:44:11Z',
  resolved: false,
  resolvable: false,
  notes: {
    pageInfo: {
      hasNextPage: false,
      endCursor: 'MQ',
    },
    nodes: [
      {
        id: 'gid://gitlab/Note/458662425',
        createdAt: '2020-12-02T09:44:11Z',
        userPermissions: {
          resolveNote: true,
        },
        system: true,
        author: {
          avatarUrl:
            'https://secure.gravatar.com/avatar/24d3a696fcc9592d18db6e623c0e654e?s=80&d=identicon',
          name: 'Vitaly Markov',
          username: 'vymarkov',
          webUrl: 'https://gitlab.com/vymarkov',
        },
        body: 'added 2 commits\n\n<ul><li>5b63a281 - fix(lint): Fix linter errors</li><li>618c91eb - docs: Update CONTRIBUTING.md</li></ul>\n\n[Compare with previous version](/gitlab-org/gitlab-vscode-extension/-/merge_requests/130/diffs?diff_id=128320927&start_sha=2a7d1c93417adaafaee85b0345fdf8ea3f28c847)',
        bodyHtml:
          '<p data-sourcepos="1:1-1:15" dir="auto">added 2 commits</p>&#x000A;<ul dir="auto">&#x000A;<li>&#x000A;<a href="/gitlab-org/gitlab-vscode-extension/-/merge_requests/130/diffs?commit_id=5b63a28151c5028e6bc0758ec1c28d4c36256a58" data-original="5b63a281" data-link="false" data-link-reference="false" data-project="278964" data-commit="5b63a28151c5028e6bc0758ec1c28d4c36256a58" data-reference-type="commit" data-container="body" data-placement="top" title="fix(lint): Fix linter errors" class="gfm gfm-commit has-tooltip">5b63a281</a> - fix(lint): Fix linter errors</li>&#x000A;<li>&#x000A;<a href="/gitlab-org/gitlab-vscode-extension/-/merge_requests/130/diffs?commit_id=618c91ebd1527deef3740f66d8950ecc85032782" data-original="618c91eb" data-link="false" data-link-reference="false" data-project="278964" data-commit="618c91ebd1527deef3740f66d8950ecc85032782" data-reference-type="commit" data-container="body" data-placement="top" title="docs: Update CONTRIBUTING.md" class="gfm gfm-commit has-tooltip">618c91eb</a> - docs: Update CONTRIBUTING.md</li>&#x000A;</ul>&#x000A;<p data-sourcepos="5:1-5:164" dir="auto"><a href="/gitlab-org/gitlab-vscode-extension/-/merge_requests/130/diffs?diff_id=128320927&amp;start_sha=2a7d1c93417adaafaee85b0345fdf8ea3f28c847">Compare with previous version</a></p>',
      },
    ],
  },
};

const systemNoteTextSnippet = 'added 2 commits';

const note1 = {
  id: 'gid://gitlab/Note/459020558',
  createdAt: '2020-12-02T17:00:04Z',
  userPermissions: {
    resolveNote: true,
    adminNote: true,
    createNote: true,
  },
  system: false,
  author: {
    avatarUrl:
      'https://secure.gravatar.com/avatar/6042a9152ada74d9fb6a0cdce895337e?s=80&d=identicon',
    name: 'Tomas Vik',
    username: 'viktomas',
    webUrl: 'https://gitlab.com/viktomas',
  },
  body: "@vymarkov Thank you for fixing the `CONTRIBUTING.md` :tada:\n\nRegarding the change in `src/gitlab_service.ts`, I think we should still show some message to the user when they try to run `GitLab: *` command and the extension fails to execute it.\n\nWe had a lot of troubles in the past when we were swallowing errors and then we weren't able to help the extension users debug any potential issues. (https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/145)",
  bodyHtml:
    '<p data-sourcepos="1:1-1:59" dir="auto"><a href="/vymarkov" data-user="359491" data-reference-type="user" data-container="body" data-placement="top" class="gfm gfm-project_member js-user-link" title="Vitaly Markov">@vymarkov</a> Thank you for fixing the <code>CONTRIBUTING.md</code> <gl-emoji title="party popper" data-name="tada" data-unicode-version="6.0">🎉</gl-emoji></p>&#x000A;<p data-sourcepos="3:1-3:182" dir="auto">Regarding the change in <code>src/gitlab_service.ts</code>, I think we should still show some message to the user when they try to run <code>GitLab: *</code> command and the extension fails to execute it.</p>&#x000A;<p data-sourcepos="5:1-5:217" dir="auto">We had a lot of troubles in the past when we were swallowing errors and then we weren\'t able to help the extension users debug any potential issues. (<a href="https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/145" data-original="https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/145" data-link="false" data-link-reference="true" data-project="278964" data-issue="30087182" data-reference-type="issue" data-container="body" data-placement="top" title="Error reporting to VSCode OutputChannel" class="gfm gfm-issue has-tooltip">#145 (closed)</a>)</p>',
};

const note1TextSnippet =
  'I think we should still show some message to the user when they try to run';

const note2 = {
  id: 'gid://gitlab/DiscussionNote/465896084',
  createdAt: '2020-12-14T08:51:37Z',
  userPermissions: {
    resolveNote: true,
    adminNote: true,
    createNote: true,
  },
  system: false,
  author: {
    avatarUrl:
      'https://secure.gravatar.com/avatar/6042a9152ada74d9fb6a0cdce895337e?s=80&d=identicon',
    name: 'Tomas Vik',
    username: 'viktomas',
    webUrl: 'https://gitlab.com/viktomas',
  },
  body: '@KevSlashNull This is a good improvement :money_with_wings:. Would it be possible to also replace `moment` in [`Date.vue`](https://gitlab.com/gitlab-org/gitlab-vscode-extension/blob/bec5ccb142e4890e20f5f0036cc1e878ff761309/src%2Fwebview%2Fsrc%2Fcomponents%2FDate.vue#L14-18) in the `webview`? I know that the dependencies are managed separately, but it would be good for consistency to update both places.',
  bodyHtml:
    '<p data-sourcepos="1:1-1:405" dir="auto"><a href="/KevSlashNull" data-user="2190515" data-reference-type="user" data-container="body" data-placement="top" class="gfm gfm-project_member js-user-link" title="Kev">@KevSlashNull</a> This is a good improvement <gl-emoji title="money with wings" data-name="money_with_wings" data-unicode-version="6.0">💸</gl-emoji>. Would it be possible to also replace <code>moment</code> in <a href="https://gitlab.com/gitlab-org/gitlab-vscode-extension/blob/bec5ccb142e4890e20f5f0036cc1e878ff761309/src%2Fwebview%2Fsrc%2Fcomponents%2FDate.vue#L14-18"><code>Date.vue</code></a> in the <code>webview</code>? I know that the dependencies are managed separately, but it would be good for consistency to update both places.</p>',
};

const note2TextSnippet = 'I know that the dependencies are managed separately, but it would';

const noteOnDiffBody =
  'This is the core improvement. `NoteBody` sends the `note.body` to our `/api/v4/markdown` endpoint to render HTML. For labels, we can easily render the HTML ourselves, saving all the API requests and complexity.';

const noteOnDiff = {
  id: 'gid://gitlab/DiffNote/469379582',
  createdAt: '2020-12-17T17:20:14Z',
  userPermissions: {
    resolveNote: true,
    adminNote: true,
    createNote: true,
  },
  system: false,
  author: {
    avatarUrl:
      'https://secure.gravatar.com/avatar/6042a9152ada74d9fb6a0cdce895337e?s=80&d=identicon',
    name: 'Tomas Vik',
    username: 'viktomas',
    webUrl: 'https://gitlab.com/viktomas',
  },
  body: noteOnDiffBody,
  bodyHtml:
    '<p data-sourcepos="1:1-1:210" dir="auto">This is the core improvement. <code>NoteBody</code> sends the <code>note.body</code> to our <code>/api/v4/markdown</code> endpoint to render HTML. For labels, we can easily render the HTML ourselves, saving all the API requests and complexity.</p>',
  url: 'https://gitlab.com/viktomas/test-project/-/merge_requests/7#note_754841236',
  position: {
    diffRefs: {
      baseSha: '18307069cfc96892bbe93a15249bd91babfa1064',
      headSha: 'b9c6f9ad70d55a75785fb2702ab8012a69e767d3',
      startSha: 'b9c6f9ad70d55a75785fb2702ab8012a69e767d3',
    },
    filePath: 'src/webview/src/components/LabelNoteOld.vue',
    positionType: 'text',
    newLine: null,
    oldLine: 48,
    newPath: 'src/webview/src/components/LabelNoteNew.vue',
    oldPath: 'src/webview/src/components/LabelNoteOld.vue',
  },
};

const noteOnDiffWithSuggestion = {
  id: 'gid://gitlab/DiffNote/771043162',
  createdAt: '2021-12-13T13:13:06Z',
  system: false,
  author: {
    avatarUrl:
      'https://secure.gravatar.com/avatar/6042a9152ada74d9fb6a0cdce895337e?s=80&d=identicon',
    name: 'Tomas Vik',
    username: 'viktomas',
    webUrl: 'https://gitlab.com/viktomas',
  },
  body: '```suggestion:-0+0\nfunction anotherFunction1(): void{\n```\n\n```suggestion:-0+0\nfunction anotherFunction2(): void{\n```',
  bodyHtml:
    '<pre data-sourcepos="1:1-3:3" class="code highlight js-syntax-highlight language-suggestion" lang="suggestion" data-lang-params="-0+0" v-pre="true"><code class="js-render-suggestion"><span id="LC1" class="line" lang="suggestion">function anotherFunction1(): void{</span></code></pre>&#x000A;<pre data-sourcepos="5:1-7:3" class="code highlight js-syntax-highlight language-suggestion" lang="suggestion" data-lang-params="-0+0" v-pre="true"><code class="js-render-suggestion"><span id="LC1" class="line" lang="suggestion">function anotherFunction2(): void{</span></code></pre>',
  url: 'https://gitlab.com/viktomas/test-project/-/merge_requests/7#note_771043162',
  userPermissions: {
    resolveNote: true,
    adminNote: true,
    createNote: true,
  },
  position: {
    diffRefs: {
      baseSha: '5e6dffa282c5129aa67cd227a0429be21bfdaf80',
      headSha: 'f9ce7e16e56c162edbc9e480108041cf6b0291fe',
      startSha: '5e6dffa282c5129aa67cd227a0429be21bfdaf80',
    },
    filePath: 'test.ts',
    positionType: 'text',
    newLine: 24,
    oldLine: null,
    newPath: 'test.ts',
    oldPath: 'test.js',
  },
};

const singleNote = {
  replyId: 'gid://gitlab/IndividualNoteDiscussion/afbf8f461a773fc130aa8091c6636f22efb5f4c5',
  createdAt: '2020-12-02T17:00:04Z',
  resolved: false,
  resolvable: true,
  notes: {
    pageInfo: {
      hasNextPage: false,
      endCursor: 'MQ',
    },
    nodes: [note1],
  },
};

const multipleNotes = {
  replyId: 'gid://gitlab/IndividualNoteDiscussion/afbf8f461a773fc130aa8091c6636f22efb5f4c5',
  createdAt: '2020-12-02T17:00:04Z',
  resolved: false,
  resolvable: true,
  notes: {
    pageInfo: {
      hasNextPage: false,
      endCursor: 'MQ',
    },
    nodes: [note1, note2],
  },
};

const discussionOnDiff = {
  replyId: 'gid://gitlab/DiffDiscussion/9a702bfa62ab0a6e7c1bee74444086567e5e99e6',
  createdAt: '2020-12-17T17:20:14Z',
  resolved: false,
  resolvable: true,
  notes: {
    pageInfo: {
      hasNextPage: false,
      endCursor: 'MQ',
    },
    nodes: [noteOnDiff],
  },
};

const projectWithIssueDiscussions = {
  project: {
    id: 'gid://gitlab/Project/278964',
    issue: {
      discussions: {
        pageInfo: {
          hasNextPage: false,
          endCursor: 'Nw',
        },
        nodes: [systemNote, singleNote, multipleNotes],
      },
    },
  },
};

const projectWithMrDiscussions = {
  project: {
    id: 'gid://gitlab/Project/278964',
    mergeRequest: {
      discussions: {
        pageInfo: {
          hasNextPage: false,
          endCursor: 'Nw',
        },
        nodes: [systemNote, singleNote, discussionOnDiff],
      },
    },
  },
};

module.exports = {
  projectWithIssueDiscussions,
  projectWithMrDiscussions,
  note1,
  note1TextSnippet,
  note2,
  note2TextSnippet,
  noteOnDiff,
  noteOnDiffBody,
  noteOnDiffWithSuggestion,
  singleNote,
  multipleNotes,
  discussionOnDiff,
  systemNote,
  systemNoteTextSnippet,
};
