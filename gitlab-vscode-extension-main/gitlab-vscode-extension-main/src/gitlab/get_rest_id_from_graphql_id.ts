import assert from 'assert';

// copied from the gitlab-org/gitlab project
// https://gitlab.com/gitlab-org/gitlab/-/blob/a4b939809c68c066e358a280491bf4ec2ff439a2/app/assets/javascripts/graphql_shared/utils.js#L9-10
export const getRestIdFromGraphQLId = (gid: string): number => {
  const result = parseInt(gid.replace(/gid:\/\/gitlab\/.*\//g, ''), 10);
  assert(result, `the gid ${gid} can't be parsed into REST id`);
  return result;
};
