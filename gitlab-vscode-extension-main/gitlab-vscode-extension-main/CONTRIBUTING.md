## Developer Certificate of Origin + License

By contributing to GitLab B.V., You accept and agree to the following terms and
conditions for Your present and future Contributions submitted to GitLab B.V.
Except for the license granted herein to GitLab B.V. and recipients of software
distributed by GitLab B.V., You reserve all right, title, and interest in and to
Your Contributions. All Contributions are subject to the following DCO + License
terms.

[DCO + License](https://gitlab.com/gitlab-org/dco/blob/master/README.md)

All Documentation content that resides under the [docs/ directory](/docs) of this
repository is licensed under Creative Commons:
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

_This notice should stay as the first item in the CONTRIBUTING.md file._

---

# Contributing to GitLab Workflow

Thank you for your interest in contributing to GitLab Workflow! This guide details how to contribute
to this extension in a way that is easy for everyone. These are mostly guidelines, not rules.
Use your best judgement, and feel free to propose changes to this document in a merge request.

## Code of Conduct

We want to create a welcoming environment for everyone who is interested in contributing. Visit our [Code of Conduct page](https://about.gitlab.com/community/contribute/code-of-conduct/) to learn more about our commitment to an open and welcoming environment.

## Getting Started

### Reporting Issues

Create a [new issue from the "Bug" template](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/new?issuable_template=Bug) and follow the instructions in the template.

### Proposing Features

Create a [new issue from the "Feature Proposal" template](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/new?issuable_template=Feature%20Proposal) and follow the instructions in the template.

### Your First Code Contribution?

Read about the extension architecture in [architecture.md](docs/developer/architecture.md). This document explains how we structure our code and will help you orientate yourself in the codebase.

For newcomers to the project, you can take a look at issues labelled as `Accepting merge requests`
as available [here](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues?label_name[]=Accepting%20merge%20requests).

### Configuring Development Environment

For general information how to develop and debug VS Code Extensions, please see the [official documentation](https://code.visualstudio.com/api).

The following instructions will help you run the GitLab Workflow Extension locally.

Please review our [Coding guidelines](docs/developer/coding-guidelines.md) before writing new code.

#### Step - 1 : Installation Prerequisites

We're assuming that you already have [Visual Studio Code](https://code.visualstudio.com/) installed along
with [GitLab Workflow](https://marketplace.visualstudio.com/items?itemName=GitLab.gitlab-workflow) installed
and configured, if not, do that first! If already done, proceed ahead.

- [Git](https://git-scm.com/)
- [NodeJS](https://nodejs.org/en/)
  - Version is specified in [`.tool-versions`](.tool-versions))
  - We use the same major node version as VS Code
  - Please use [`asdf`](https://asdf-vm.com/#/) with the [`nodejs` plugin](https://github.com/asdf-vm/asdf-nodejs) to manage your node version
- [Npm](https://www.npmjs.com/get-npm) (installed automatically by the `asdf` `nodejs` plugin)

#### Step - 2 : Fork and Clone

- Use your GitLab account to [fork](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/forks/new) this project
  - Don't know how forking works? Refer to [this guide](https://docs.gitlab.com/ee/gitlab-basics/fork-project.html#doc-nav).
  - Don't have GitLab account? [Create one](https://gitlab.com/users/sign_up)! It is free and it is awesome!
- Visit your forked project (usually URL is `https://gitlab.com/<your user name>/gitlab-vscode-extension`).
- Set up pull mirroring to keep your fork up to date.
  - [How do I mirror repositories?](https://docs.gitlab.com/ee/user/project/repository/repository_mirroring.html#pulling-from-a-remote-repository)
  - Use `https://gitlab.com/gitlab-org/gitlab-vscode-extension.git` as the **Git repository URL**.
  - Mirroring the main repository is important to avoid false negatives of the commit linting, which is caused by an outdated `main` branch in forks. [#288](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/288) tracks the progress to resolve that bug.
- Go to your project overview and copy the SSH or HTTPS URL to clone the project into your system.
  - Don't know how to clone a project? Refer to [this guide](https://docs.gitlab.com/ee/gitlab-basics/command-line-commands.html#clone-your-project).

#### Step - 3 : Install dependencies

Once project is cloned, open terminal within the project folder and run following;

```bash
npm install
npm run webview
```

This command will install all necessary dependencies to run and debug extension in developer mode.

#### Step - 4 : Running the extension

Open the extension project in VS Code (e.g. by running `code .` in the project folder).

To run the extension in development mode:

1. Run the `View: Show Run and Debug` command (<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>).
1. Select the green play icon, or press <kbd>F5</kbd>.

You can read through the [Running and debugging your extension](https://code.visualstudio.com/api/working-with-extensions/bundling-extension#run-the-extension) section of the official documentation.

#### Step - 5 : Troubleshooting

Logs can be found by running `Developer: Show Logs ...` command (using `cmd+shift+p`) and selecting `Extension Host`.

You can always use debugger when you are running the extension in development mode.

#### Step - 6 : Run tests

To run tests in the terminal, run the following command from within the project folder:

```bash
npm test
```

The integration tests might not run if you have a VS Code instance already open. In that case either close all VS Code windows or run the tests from VS Code:

To run tests from the VS Code, use the `Unit Tests` and `Integration Tests` [launch configurations](https://code.visualstudio.com/Docs/editor/debugging#_launch-configurations) in the [Run view](https://code.visualstudio.com/Docs/editor/debugging#_run-view).

See also [how to write automated tests](docs/developer/writing-tests.md).

#### Step - 7 : Run linter

To run linters, open terminal within the project folder and run following;

```bash
npm run autofix # Automatically formats your code using prettier and fixes eslint errors
npm run lint
```

#### Step - 8 : Add documentation

If you added or changed a feature, add the documentation to the README.

The majority of the user documentation is directly in [`README.md`](README.md), because that file is rendered in:

- The [extension marketplace page](https://marketplace.visualstudio.com/items?itemName=GitLab.gitlab-workflow).
- The extension overview directly in VS Code.

To add documentation that includes a new image:

1. Add images into the `docs/assets` folder, and commit the changes.
1. Edit the README file, and insert full permalinks to your new images.
   The permalinks contain the commit SHA from your first commit, and are
   in the form of:

   ```plaintext
   https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/raw/<COMMIT_SHA>/src/assets/imagename.png
   ```

1. Commit your text changes.

For more examples, refer to the `gif` images in the README file.

### Opening Merge Requests

Steps to opening a merge request to contribute code to GitLab Workflow is similar to any other open source project.
You develop in a separate branch of your own fork and the merge request should have a related issue open in the project.
Any Merge Request you wish to open in order to contribute to GitLab Workflow, be sure you have followed through the steps from [Configuring Development Environment](#configuring-development-environment).

In this project, we don't [close issues automatically when the MR gets merged](https://docs.gitlab.com/ee/user/project/issues/managing_issues.html#closing-issues-automatically). Instead, we close the issues when the MR change is [released](docs/developer/release-process.md). Please replace `Closes #<issueId>` in the MR description with `Relates to #<issueId>`.
