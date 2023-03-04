import { gql } from 'graphql-request';
import {
  discussionDetailsFragment,
  Node,
  GqlProjectResult,
  GqlNote,
  GqlTextDiffNote,
  GqlOverviewNote,
  GqlImageNote,
} from './shared';

const discussionsFragment = gql`
  ${discussionDetailsFragment}
  fragment discussions on DiscussionConnection {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      ...discussionDetails
    }
  }
`;

export const getMrDiscussionsQuery = gql`
  ${discussionsFragment}
  query GetMrDiscussions($namespaceWithPath: ID!, $iid: String!, $afterCursor: String) {
    project(fullPath: $namespaceWithPath) {
      id
      mergeRequest(iid: $iid) {
        discussions(after: $afterCursor) {
          ...discussions
        }
      }
    }
  }
`;

export const getIssueDiscussionsQuery = gql`
  ${discussionsFragment}
  query GetIssueDiscussions($namespaceWithPath: ID!, $iid: String!, $afterCursor: String) {
    project(fullPath: $namespaceWithPath) {
      id
      issue(iid: $iid) {
        discussions(after: $afterCursor) {
          ...discussions
        }
      }
    }
  }
`;

export interface GetDiscussionsQueryOptions {
  namespaceWithPath: string;
  iid: string;
  afterCursor?: string;
}

interface GqlGenericDiscussion<T extends GqlNote> {
  replyId: string;
  createdAt: string;
  resolved: boolean;
  resolvable: boolean;
  notes: Node<T>;
}

export type GqlTextDiffDiscussion = GqlGenericDiscussion<GqlTextDiffNote>;

export type GqlDiscussion =
  | GqlGenericDiscussion<GqlTextDiffNote>
  | GqlGenericDiscussion<GqlImageNote>
  | GqlGenericDiscussion<GqlOverviewNote>;

interface GqlDiscussionsProject {
  mergeRequest?: {
    discussions: Node<GqlDiscussion>;
  };
  issue?: {
    discussions: Node<GqlDiscussion>;
  };
}

export type GetDiscussionsQueryResult = GqlProjectResult<GqlDiscussionsProject>;
