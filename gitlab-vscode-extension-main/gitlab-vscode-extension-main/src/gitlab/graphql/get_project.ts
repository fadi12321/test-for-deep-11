import { gql } from 'graphql-request';
import { fragmentProjectDetails, GqlProject, GqlProjectResult } from './shared';

export const queryGetProject = gql`
  ${fragmentProjectDetails}
  query GetProject($namespaceWithPath: ID!) {
    project(fullPath: $namespaceWithPath) {
      ...projectDetails
    }
  }
`;

export interface GetProjectQueryOptions {
  namespaceWithPath: string;
}

export type GetProjectQueryResult = GqlProjectResult<GqlProject>;
