import { gql } from 'graphql-request';
import { GqlProjectResult, Node } from './shared';

export const queryGetSnippets = gql`
  query GetSnippets($namespaceWithPath: ID!, $afterCursor: String) {
    project(fullPath: $namespaceWithPath) {
      id
      snippets(after: $afterCursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          title
          description
          blobs {
            nodes {
              name
              path
              rawPath
            }
          }
        }
      }
    }
  }
`;

export interface GetSnippetsQueryOptions {
  namespaceWithPath: string;
  afterCursor?: string;
}

export interface GqlBlob {
  name: string;
  path: string;
  rawPath: string;
}

export interface GqlSnippet {
  id: string;
  projectId: string;
  title: string;
  description: string;
  blobs: Node<GqlBlob>;
}

interface GqlSnippetProject {
  id: string;
  snippets: Node<GqlSnippet>;
}

export type GetSnippetsQueryResult = GqlProjectResult<GqlSnippetProject>;
