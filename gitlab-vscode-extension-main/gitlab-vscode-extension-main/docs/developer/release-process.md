---
stage: Create
group: Editor
info: To determine the technical writer assigned to the Stage/Group associated with this page, see https://about.gitlab.com/handbook/product/ux/technical-writing/#assignments
---

# Release process

Perform the following steps to release a new version of the extension.

1. (Optional.) Do a quick test of the extension in your local development. At this stage, you
   are only verifying there is no complete failure of the extension.
1. Update the package version in `npm version <type>`. This automatically generates a changelog entry. Specify the `type` as:
   - `patch` - if you only released bugfixes
   - `minor` - if you released ane new `feature: `
   - `major` - we haven't changed major version yet, do this if you introduce severe breaking changes
1. If there have been community contributions:

   1. Manually add attribution to the `CHANGELOG.md` and `CONTRIBUTORS.md`. For example:

      ```plaintext
      (Implemented|Fixed) by [@flood4life](https://gitlab.com/flood4life) with [MR !90](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/90) 👍
      ```

1. Run the command `git push origin main` and `git push --tags`.
1. Trigger the **Publish** steps (`publish_marketplace` and `publish_open_vsx`) on the tag pipeline that you created by pushing the new tag.
1. When the extension updates in your VS Code, check that the extension works.
1. Add a message to our `#f_vscode_extension` slack channel:

   ```plaintext
   :vscode:  [GitLab Workflow](https://marketplace.visualstudio.com/items?itemName=gitlab.gitlab-workflow) `3.0.0` has been released :rocket:
   See [CHANGELOG.md](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/main/CHANGELOG.md).
   ```

## Access tokens for Marketplaces

_This section applies once a year when the Microsoft VS Code Marketplace token automatically expires._

Our [CI/CD jobs](https://gitlab.com/gitlab-org/gitlab-vscode-extension/blob/e80e5798dbac5944ebaa52dc0dc2cb861509588e/.gitlab-ci.yml#L110-124) use the access tokens for publishing packaged extension to market places.

### How to generate tokens

#### Open VSX

1. Log in to [github.com](https://github.com/) with `GitHub vscode account`
   credentials from the "VS Code Extension" 1Password Vault.
1. Log in to [open-vsx.org](https://open-vsx.org/) with the GitHub account.
1. Go to the [Access Tokens Settings page](https://open-vsx.org/user-settings/tokens).
1. Create a new token.

#### Microsoft VS Code Marketplace

1. Sign in to [Microsoft Azure](https://azure.microsoft.com/) with `VScode Marketplace`
   credentials from the "VS Code Extension" 1Password Vault.
1. Go to **Personal Access Tokens**.
   ([Official VS Code publishing documentation](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token)).
1. You can either:
   - Extend the expiration date of an existing token. **This solution is the best one when you receive token expiration email.**
   - Generate a new token. Assign it the least privileges possible - it probably only
     needs **Marketplace - publish**.
