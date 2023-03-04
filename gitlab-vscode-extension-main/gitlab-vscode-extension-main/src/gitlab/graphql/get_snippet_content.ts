import { gql } from 'graphql-request';
import { Node } from './shared';

export const getSnippetContentQuery = gql`
  query GetSnippetContent($snippetId: SnippetID!) {
    snippets(ids: [$snippetId]) {
      nodes {
        blobs {
          nodes {
            path
            rawPlainData
          }
        }
      }
    }
  }
`;

export interface GetSnippetContentQueryOptions {
  snippetId: string;
}

export interface GqlContentBlob {
  path: string;
  rawPlainData: string;
}

export interface GqlContentSnippet {
  blobs: Node<GqlContentBlob>;
}
