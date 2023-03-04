import { gql } from 'graphql-request';
import { discussionDetailsFragment } from './shared';

export interface GqlDiffPositionInput {
  baseSha: string;
  headSha: string;
  startSha: string;
  paths: {
    newPath: string;
    oldPath: string;
  };
  newLine?: number;
  oldLine?: number;
}

export const createDiffNoteMutation = gql`
  ${discussionDetailsFragment}
  mutation CreateDiffNote($issuableId: NoteableID!, $body: String!, $position: DiffPositionInput!) {
    createDiffNote(input: { noteableId: $issuableId, body: $body, position: $position }) {
      errors
      note {
        discussion {
          ...discussionDetails
        }
      }
    }
  }
`;
