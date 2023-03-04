---
stage: Create
group: Editor
info: To determine the technical writer assigned to the Stage/Group associated with this page, see https://about.gitlab.com/handbook/product/ux/technical-writing/#assignments
---

# GitLab remote URL format

You can create custom remote GitLab URLs that set values for both GitLab and
Visual Studio Code. Use these URLs to browse remote GitLab repositories
[in read-only mode](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/main/README.md#browse-a-repository-without-cloning),

GitLab remote URLs follow this format:

```plaintext
gitlab-remote://<INSTANCE_URL>/<LABEL>?project=<PROJECT_ID>&ref=<GIT_REFERENCE>
```

For example, the remote URL for the main GitLab project is:

```plaintext
gitlab-remote://gitlab.com/<label>?project=278964&ref=master
```

## Fields for remote URLs

- `instanceUrl` - The GitLab instance URL, not including `https://` or `http://`. If the GitLab instance is [installed under a relative URL](https://docs.gitlab.com/ee/install/relative_url.html), you must include the relative URL in the URL. For example, the URL for the `main` branch of the project `templates/ui` on the instance `example.com/gitlab` is `gitlab-remote://example.com/gitlab/<label>?project=templates/ui&ref=main`.
- `label` - The text Visual Studio Code uses as the name of this workspace folder:
  - It must appear immediately after the instance URL.
  - It must not contain unescaped URL components, such as `/` or `?`.
  - For an instance installed at the domain root, such as `https://gitlab.com`, the label must be the first path element.
  - For URLs that refer to the root of a repository, the label must be the last path element.
  - Any path elements that appear after the label are treated as a path inside the repository. For example, `gitlab-remote://gitlab.com/GitLab/app?project=gitlab-org/gitlab&ref=master` refers to the `app` directory of the `gitlab-org/gitlab` repository on GitLab.com.
- `projectId` - Can be either the numeric id (`5261717`) or the namespace (`gitlab-org/gitlab-vscode-extension`) of the project. The project namespace might not work [when your instance uses reverse proxy](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/143).
- `gitReference` - The repository branch or commit SHA, passed verbatim to the GitLab API.
