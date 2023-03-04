import { FetchError } from '../errors/fetch_error';
import { UserFriendlyError } from '../errors/user_friendly_error';
import { GitLabService } from '../gitlab/gitlab_service';
import { Credentials } from './credentials';

export const getUserForCredentialsOrFail = async (credentials: Credentials): Promise<RestUser> => {
  try {
    return await new GitLabService(credentials).getCurrentUser();
  } catch (e) {
    const message =
      e instanceof FetchError && e.status === 401
        ? `API Unauthorized: Can't add GitLab account for ${credentials.instanceUrl}. Is your token valid?`
        : `Request failed: Can't add GitLab account for ${credentials.instanceUrl}. Check your instance URL and network connection.`;

    throw new UserFriendlyError(message, e);
  }
};
