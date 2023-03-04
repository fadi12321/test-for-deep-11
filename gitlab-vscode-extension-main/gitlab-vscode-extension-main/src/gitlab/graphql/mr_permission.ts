import { gql } from 'graphql-request';

export const getMrPermissionsQuery = gql`
  query GetMrPermissions($namespaceWithPath: ID!, $iid: String!) {
    project(fullPath: $namespaceWithPath) {
      mergeRequest(iid: $iid) {
        userPermissions {
          createNote
        }
      }
    }
  }
`;

export interface MrPermissionsQueryOptions {
  namespaceWithPath: string;
  iid: string;
}
