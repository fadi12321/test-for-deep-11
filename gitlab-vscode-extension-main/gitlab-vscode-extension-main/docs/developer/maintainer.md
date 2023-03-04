---
stage: Create
group: Editor
info: To determine the technical writer assigned to the Stage/Group associated with this page, see https://about.gitlab.com/handbook/product/ux/technical-writing/#assignments
---

# Maintainer documentation

This document is for new extension maintainers.

## Access you need

- Maintainer access to [`gitlab-org/gitlab-vscode-extension`](https://gitlab.com/gitlab-org/gitlab-vscode-extension)
- Access to "VS Code Extension" 1Password vault
- Create an [Access Request](https://about.gitlab.com/handbook/business-technology/team-member-enablement/onboarding-access-requests/access-requests/) and ask to be added to `vscode@gitlab.com` email group. Historically, EMs and PMs on the extension team also have access to this email group.

## Your responsibilities

Your responsibilities as a maintainer are a superset of those as a maintainer of the main `gitlab-org/gitlab` project. On top of MR reviews, you are also responsible for managing the community: triaging issues, responding to marketplace reviews and generally engaging with people on issues and MRs.

On the [main project page](https://gitlab.com/gitlab-org/gitlab-vscode-extension), [set your project notification settings](https://docs.gitlab.com/ee/user/profile/notifications.html#change-level-of-project-notifications) to "Watch". That way, you'll get an email for each new issue and MR in the project.

### Review MRs

You are responsible for reviewing new MRs in the project. The MR must include automated tests. A good strategy for large MRs is to ask the MR author to split the MR into multiple smaller MRs and review them one by one.

### Triage issues

Triaging the issue means trying to reproduce the bug or understanding the feature request. If the issue description is clear, the bug is reproducible, and the feature makes sense, then add the project labels:

```
/label ~"devops::create" ~"group::code review" ~"VS Code" ~"Category:Editor Extension" ~"section::dev"
```

and the appropriate [type label](https://docs.gitlab.com/ee/development/contributing/issue_workflow.html#type-labels).

If the issue isn't clear or the bug can't be reproduced, ask for more details and only add the "needs investigation" label.

```
/label ~"needs investigation"
```

If the issue description doesn't conform to the issue template, it's OK to ask the issue author to fill up the template: [example1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/377#note_564616424), [example2](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/367#note_551671061)

### Respond to Marketplace questions and reviews

You should be a member of `vscode@gitlab.com` group. If you are not, See the [Access you need](#access-you-need) section.

You'll receive emails titled `New review for GitLab Workflow on the Marketplace` and `New question for GitLab Workflow on the Marketplace`. When you receive such an email, go to the [extension marketplace page](https://marketplace.visualstudio.com/items?itemName=GitLab.gitlab-workflow) and respond to the question or review.

In the VS Code Extension 1Password Vault there is `VScode Marketplace` entry with credentials. Use these credentials to log in to [VS Code Marketplace](https://marketplace.visualstudio.com/).

- It's OK not to respond to positive reviews. But if they make your day, respond with "thank you" or something similar.
- With questions and negative reviews, try to find relevant documentation or open issues. If you can't find any, ask the person to create an issue. Use links to [Reporting issues](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/main/CONTRIBUTING.md#reporting-issues) and [Proposing features](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/main/CONTRIBUTING.md#proposing-features) sections of our CONTRIBUTING. Using these links has the added benefit of explaining the need to use the issue template.

### Releasing the extension

With the access obtained in the [Access you need](#access-you-need) section, you should be able to [release the extension](release-process.md). Only project maintainers can do that.
