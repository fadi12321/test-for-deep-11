import { gql } from 'graphql-request';
import { noteDetailsFragment } from './shared';

export const oldCreateNoteMutation = gql`
  ${noteDetailsFragment}
  mutation CreateNote($issuableId: NoteableID!, $body: String!, $replyId: DiscussionID) {
    createNote(input: { noteableId: $issuableId, body: $body, discussionId: $replyId }) {
      errors
      note {
        ...noteDetails
      }
    }
  }
`;

// mergeRequestDiffHeadSha is only supported by GitLab 14.9 and newer
// https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/545
export const newCreateNoteMutation = gql`
  ${noteDetailsFragment}
  mutation CreateNote(
    $issuableId: NoteableID!
    $body: String!
    $replyId: DiscussionID
    $mergeRequestDiffHeadSha: String
  ) {
    createNote(
      input: {
        noteableId: $issuableId
        body: $body
        discussionId: $replyId
        mergeRequestDiffHeadSha: $mergeRequestDiffHeadSha
      }
    ) {
      errors
      note {
        ...noteDetails
      }
    }
  }
`;
