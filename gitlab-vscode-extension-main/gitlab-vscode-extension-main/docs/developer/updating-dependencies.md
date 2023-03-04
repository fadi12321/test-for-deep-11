---
stage: Create
group: Editor
info: To determine the technical writer assigned to the Stage/Group associated with this page, see https://about.gitlab.com/handbook/product/ux/technical-writing/#assignments
---

# Updating dependencies

This document describes how we upgrade extension dependencies.

## VS Code

The VS Code project is the main dependency of this project. Unless we need features from a later version of VS Code (for example, https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/648 or https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/506), we usually don't increase the minimum supported version of VS Code. Increasing the minimum version means that later versions of the extension can't be installed on earlier versions of VS Code.

When we upgrade the VS Code dependency, we do the following:

1. In `package.json`, increase the minimum required VS Code version by updating the `engine` property.
1. In the `vscode` repository, open [`.nvmrc`](https://github.com/microsoft/vscode/blob/main/.nvmrc) and switch the revisions from `main` to the version tag you are upgrading to.
1. In the `vscode` repository, copy the node version from `.nvmrc` to [`.tool-versions`](../../.tool-versions).

## npm dependencies

### Main project

The npm package dependencies of the main project are automatically updated using the [frontend renovate bot](https://gitlab.com/gitlab-org/frontend/renovate-gitlab-bot/-/blob/main/renovate/projects/vscode.config.js).

### Issuable webview

The issuable webview lives in the `src/webview` folder. The npm package dependencies here are updated manually with `npm upgrade` and `npm audit`.
