import vscode from 'vscode';
import { GitLabComment } from './gitlab_comment';
import { GitLabCommentThread } from './gitlab_comment_thread';
import { noteOnDiff } from '../../test/integration/fixtures/graphql/discussions.js';
import { GqlTextDiffNote } from '../gitlab/graphql/shared';

describe('GitLabComment', () => {
  let comment: GitLabComment;

  const createGitLabComment = (note: GqlTextDiffNote) => {
    comment = GitLabComment.fromGqlNote(note, {} as GitLabCommentThread);
  };

  beforeEach(() => {
    createGitLabComment(noteOnDiff as GqlTextDiffNote);
  });
  describe('context', () => {
    it('sets context to canAdmin if the user can edit the comment', () => {
      expect(comment.contextValue).toMatch('canAdmin');
    });

    it('leaves the context undefined if the user cannot edit the comment', () => {
      createGitLabComment({
        ...(noteOnDiff as GqlTextDiffNote),
        userPermissions: {
          ...noteOnDiff.userPermissions,
          adminNote: false, // user can't edit
        },
      });
      expect(comment.contextValue).not.toMatch('canAdmin');
    });
  });

  describe('suggestion in the comment', () => {
    const suggestion = `
\`\`\`suggestion:-1+0
function containingFunctionABC(): void{
    function subFunctionDEF(): void{
\`\`\`
`;

    const renderedSuggestion = `
---

Suggestion:

\`\`\`diff
+ function containingFunctionABC(): void{
+     function subFunctionDEF(): void{
\`\`\`

*[open suggestion on the web](https://gitlab.com/viktomas/test-project/-/merge_requests/7#note_754841236)*

---


`;

    const multipleSuggestions = `Adding a line1

\`\`\`suggestion:-1+0
function containingFunctionABC(): void{
    function subFunctionDEF(): void{
\`\`\`
\`\`\`suggestion:-0+0
    function subFunctionAloha(): void{
\`\`\`

And here`;

    const renderedMultipleSuggestions = `Adding a line1

---

Suggestion:

\`\`\`diff
+ function containingFunctionABC(): void{
+     function subFunctionDEF(): void{
\`\`\`

*[open suggestion on the web](https://gitlab.com/viktomas/test-project/-/merge_requests/7#note_754841236)*

---


---

Suggestion:

\`\`\`diff
+     function subFunctionAloha(): void{
\`\`\`

*[open suggestion on the web](https://gitlab.com/viktomas/test-project/-/merge_requests/7#note_754841236)*

---



And here`;

    it('renders suggestion into markdown', () => {
      createGitLabComment({
        ...(noteOnDiff as GqlTextDiffNote),
        body: suggestion,
      });
      expect(comment.body).toEqual(new vscode.MarkdownString(renderedSuggestion));
    });

    it('renders multiple suggestions into markdown', () => {
      createGitLabComment({
        ...(noteOnDiff as GqlTextDiffNote),
        body: multipleSuggestions,
      });
      expect(comment.getBodyAsText()).toEqual(renderedMultipleSuggestions);
    });

    it('editing comment sets the comment body into original markdown', () => {
      createGitLabComment({
        ...(noteOnDiff as GqlTextDiffNote),
        body: suggestion,
      });
      expect(comment.setOriginalBody().body).toEqual(suggestion);
    });

    it('submitting edit will again render the suggestion', () => {
      createGitLabComment({
        ...(noteOnDiff as GqlTextDiffNote),
        body: suggestion,
      });
      comment = comment.setOriginalBody();
      comment.body = `${comment.body}\nabc`;
      expect(comment.markBodyAsSubmitted().getBodyAsText()).toEqual(`${renderedSuggestion}\nabc`);
    });
  });
});
