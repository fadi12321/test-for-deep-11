---
stage: Create
group: Editor
info: To determine the technical writer assigned to the Stage/Group associated with this page, see https://about.gitlab.com/handbook/product/ux/technical-writing/#assignments
---

# GitLab instance with self-signed certificate

This guide helps you configure your computer so the GitLab Workflow Extension can connect to your GitLab instance with a self-signed certificate for SSL (HTTPS).

This guide only supports using certificates signed with a self-signed certificate authority (CA). If you also use a proxy to connect to your GitLab instance, let us know in [the open issue](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/314). If you face any issues, review the [epic with all existing SSL issues](https://gitlab.com/groups/gitlab-org/-/epics/6244).

## Use the extension with a self-signed CA

If your GitLab instance uses a certificate signed with a self-signed certificate authority (CA), you must:

1. Ensure the CA certificate is correctly added to your system for the extension to work. VS Code reads the system certificate store, and changes all node `http` requests to trust the certificates:

   ```mermaid
   graph LR;
   A[self-signed CA] -- signed --> B[Your GitLab instance certificate]
   ```

   For more information, refer to [self-signed certificate error when installing Python support in WSL](https://github.com/microsoft/vscode/issues/131836#issuecomment-909983815) in the Visual Studio Code issue queue.

1. In your VS Code `settings.json`, set `"http.systemCertificates": true`. The default value is `true`, so a change may not be needed.
1. Follow the instructions for your operating system.

### Windows

> **NOTE:** These instructions were tested on Windows 10 and VS Code `1.60.0`.

Make sure you can see your self-signed CA in the Certificate store:

1. Open the command prompt.
1. Run `certmgr`.
1. Make sure you see your certificate in **Trusted Root Certification Authorities > Certificates**.

### Linux

> **NOTE:** These instructions were tested on Arch Linux `5.14.3-arch1-1`, VS Code `1.60.0`.

1. Use the tools for your operating system to make sure you can add our self-signed CA to your system:
   - `update-ca-trust` (Fedora, RHEL, CentOS)
   - `update-ca-certificates` (Ubuntu, Debian, OpenSUSE, SLES)
   - `trust` (Arch)
1. Confirm the CA certificate is in `/etc/ssl/certs/ca-certificates.crt` or `/etc/ssl/certs/ca-bundle.crt`. VS Code [checks this location](https://github.com/microsoft/vscode/issues/131836#issuecomment-909983815).

### MacOS

> **NOTE:** These instructions are untested, but are highly likely working. If you can validate this setup, leave us a note or create an issue to update this page.

Make sure you see the self-signed CA in your Keychain:

1. Go to **Finder > Applications > Utilities > Keychain Access**.
1. In the left-hand column, select **System**.
1. Your self-signed CA certificate should be on the list.
