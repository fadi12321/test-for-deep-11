import { gql } from 'graphql-request';
import { fragmentProjectDetails, GqlProject } from './shared';

export const queryGetProjects = gql`
  ${fragmentProjectDetails}
  query GetProjects(
    $search: String
    $membership: Boolean
    $limit: Int
    $searchNamespaces: Boolean
  ) {
    projects(
      search: $search
      membership: $membership
      first: $limit
      searchNamespaces: $searchNamespaces
    ) {
      nodes {
        ...projectDetails
        repository {
          empty
        }
      }
    }
  }
`;

export interface GqlProjectsResult {
  projects?: {
    nodes?: GqlProject[];
  };
}

export interface GetProjectsOptions {
  search?: string;
  membership: boolean;
  limit?: number;
  searchNamespaces?: boolean;
}
