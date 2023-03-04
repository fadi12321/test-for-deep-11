---
stage: Create
group: Editor
info: To determine the technical writer assigned to the Stage/Group associated with this page, see https://about.gitlab.com/handbook/product/ux/technical-writing/#assignments
---

# Development process

This document describes how we make changes to the extension. For contributing guidelines, please see [`CONTRIBUTING.md`](../../CONTRIBUTING.md).

## Who can make changes?

**Anyone** can make changes, if you are planning on larger changes impacting the extension architecture or dependencies, please [create an issue first](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/new?issuable_template=Feature%20Proposal).

## Who reviews the changes?

**Any member of the Create:Code Review team** (either [FE](https://about.gitlab.com/handbook/engineering/development/dev/create-code-review-fe/) or [BE](https://about.gitlab.com/handbook/engineering/development/dev/create-code-review-be/)) can review a change (MR). Each MR should have at least one review. At the moment, we don't want to have any more complexity in the process to speed up the development. The review is mainly for knowledge sharing and sanity checking. It's not a full sign off the same way a maintainer would sign off a change to the [`gitlab-org/gitlab`](https://gitlab.com/gitlab-org/gitlab/) project.

## Who releases the changes?

Only [project maintainers](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/project_members?sort=access_level_desc) can tag a release. Follow the [release process](release-process.md).
