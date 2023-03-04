# [3.60.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.59.2...v3.60.0) (2023-02-20)


### Bug Fixes

* Don't use NODE_ENV for selecting webview ([e04abce](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/e04abce24ec94278240d0d56e6441f8906360ad5))
  * Fixed by [Lennard Sprong](https://gitlab.com/X_Sheep) with [MR !727](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/727) 👍
* Properly handle SSH URLs with custom ports ([23e851d9](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/23e851d9ac836bb2bca455d541c29762bccbb37d))
  * Fixed by [Johannes May](https://gitlab.com/johannesmay) with [MR !736](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/736) 👍


### Features

* Change Compare command to use default branch ([179aa19](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/179aa19afb0b2508e9daf8701954a40d73403d2e))
  * Implemented by [Lennard Sprong](https://gitlab.com/X_Sheep) with [MR !723](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/723) 👍
* Display message when job is erased ([7c69a84](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/7c69a849c0ba7736cd8edfeed952575c7371ccb3))
  * Implemented by [Lennard Sprong](https://gitlab.com/X_Sheep) with [MR !725](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/725) 👍



## [3.59.2](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.59.1...v3.59.2) (2023-01-19)


### Bug Fixes

* Exclude pendingjob.html in vscodeignore ([456c203](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/456c20359565af4d821c647596fb53a8b6351b3e))
  * Fixed by [Lennard Sprong](https://gitlab.com/X_Sheep) with [MR !718](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/718) 👍



## [3.59.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.59.0...v3.59.1) (2023-01-18)


### Bug Fixes

* remove SVG badges from README to fix publishing ([82e2248](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/82e2248e53391dd2f5336c17ed8694a476945abc))



# [3.59.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.58.0...v3.59.0) (2023-01-18)


### Features

* View Pending CI jobs ([0f2ab11](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/0f2ab11562ad42a938710472d09087e070676566))
  * Implemented by [Lennard Sprong](https://gitlab.com/X_Sheep) with [MR !705](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/705) 👍



# [3.58.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.57.3...v3.58.0) (2023-01-12)


### Features

* Allow custom query reviewer Any and None ([1319283](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/13192830c28bf8da647326ea7126a1820b2d93e9))
  * Fixed by [Raul Reyes](https://gitlab.com/mk/raul-reclique) with [MR !713](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/713) 👍

### Refactoring

* [refactor: Add EventEmitter to CurrentBranchRefresher](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/703)
  * Implemented by [Lennard Sprong](https://gitlab.com/X_Sheep) 🎉🔥



## [3.57.3](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.57.2...v3.57.3) (2022-12-13)


### Bug Fixes

* Allow AI Assist server url to be empty ([95d292b](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/95d292b91a7c36cac23f44bd75385673540137f9))
* don't override OAuth token with an invalid response ([a2528ee](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/a2528eec15ee93474ce1eefcdbf20a9fa65606d0))



## [3.57.2](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.57.1-fix...v3.57.2) (2022-12-01)

* Small documentation updates and updated URL for GitLab code completion.

## [3.57.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.56.0...v3.57.1) (2022-11-17)


### Bug Fixes

* Fetch all jobs in the pipeline instead of just first page ([1becad8](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/1becad88a98ce8023f1d1ed62e2b9fcc6c09688f))
  * Fixed by [Mikhail Kuryshev](https://gitlab.com/mk9) with [MR !680](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/680) 👍


# [3.57.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.56.0...v3.57.0) (2022-11-15)


### Features

**All features in this release have been implemented by [Lennard Sprong](https://gitlab.com/X_Sheep)** 🚀. Thank you once again for making the extension better 🙇

* Display trace for running Jobs ([c5633b1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/c5633b1f3ff8fad7399c44bcad53a0cf893182f1)) [MR !674](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/674)



# [3.56.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.55.0...v3.56.0) (2022-11-08)


### Bug Fixes

* Do not log.debug all account props ([498a8d1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/498a8d117125a992b8c2bffc81745765e66d1e00))


### Features

* ai assist stop sequences ([2152712](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/215271243c81c9bd2df790b6c4fa054ce6774ef0))


### Performance Improvements

* Reduce number of calls AI assist makes ([e474dc7](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/e474dc78cb9a4023c5ec296605bb8dedd13805d4))



## [3.55.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.55.0...v3.55.1) (2022-11-08)


### Bug Fixes

* Do not log.debug all account props ([916961a](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/916961a905e1cfb0f6fabaa83a6d366c57aa6814))



# [3.55.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.54.0...v3.55.0) (2022-10-31)


### Features

* Add authentication for AI Assist ([3b5a9fe](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/3b5a9feabf9168336a74691359f5e4303d602a7d))
* open changed MR file using a context menu in the TreeView ([39937c5](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/39937c53aaca39f1371a6a1e7db438e7628359fa))



# [3.54.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.53.0...v3.54.0) (2022-10-12)


### Features

**All features in this release have been implemented by [Lennard Sprong](https://gitlab.com/X_Sheep)** 🚀. Thank you once again for making the extension better 🙇

* Display external status in pipeline tree ([1278c37](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/1278c37196bd48874ca92e5885b3c52c85e67120)) [MR !671](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/671)
* display logs for finished CI jobs ([0c7dcb2](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/0c7dcb2a4ffe782781fb8284061e4ee113a770d9)) [MR !661](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/661)



# [3.53.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.52.0...v3.53.0) (2022-10-10)


### Features

* Add support for AI-assisted code completion (alpha) ([446cc63](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/446cc63a6034c0d6ef3c9b970015b4be40d64e6e))



# [3.52.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.51.0...v3.52.0) (2022-09-23)


### Bug Fixes

* mention GitLab: Remove Account command in docs and error messages ([382dd76](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/382dd76de21bf6fc494ca60f38244edf1b794588))


### Features

* Allow disabling Status bar items through VS Code UI ([542eac7](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/542eac7709b3fd7b7b5e8b89519abbb4872bb64d))
  * Implemented by [Lennard Sprong](https://gitlab.com/X_Sheep) with [MR !649](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/649) 👍
* YAML Completion with variable names in braces ([1e41b29](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/1e41b2908f1d24afc8ad00b4b0cc745270d7ee3d))
  * Implemented by [Lennard Sprong](https://gitlab.com/X_Sheep) with [MR !650](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/650) 👍



# [3.51.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.50.0...v3.51.0) (2022-09-15)


### Features

* Allow retrieving pipelines for tags ([4cdfcc5](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/4cdfcc5540481dd2ecf42ac7a6fff1d5389cf073))
  * Implemented by [Lennard Sprong](https://gitlab.com/X_Sheep) with [MR !644](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/644) 👍



# [3.50.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.49.0...v3.50.0) (2022-09-09)


### Bug Fixes

* use project id from the project in repository ([63dbf50](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/63dbf50717ff5b4e25d4e06a0335ec2c30549c7b))


### Features

**All features in this release have been implemented by [Lennard Sprong](https://gitlab.com/X_Sheep)** 🚀. Thank you so much for making the extension better 🙇

* Add context menu buttons for retrying/cancelling Job ([2134f78](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/2134f78b9bd640e3efa8e9ce13e710a826a6853c)) [MR !633](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/633)
* Add pipeline menu action for downloading artifacts ([f4d027c](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/f4d027c616c884bef9fc42e5f20dfac43b811134)) [MR !635](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/635)
* Add retry/cancel pipeline to context menu ([c2caee4](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/c2caee40cfcbfb5d13cc790f9a2d1cfcf6c6a7ab)) [MR !637](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/637)
* Display merged CI YAML ([3c3a67a](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/3c3a67ab2ecc0c5270aba5e515919b78f15f2ce5)) [MR !626](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/626)



# [3.49.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.48.1...v3.49.0) (2022-08-30)


### Bug Fixes

* Show proper error message when add token to existing account fails ([c6a3b8b](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/c6a3b8bce38c9df7e65dc45114e9f7d23f2261af))
  * Implemented by [Chris Qiang](https://gitlab.com/chez14) with [MR !623](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/623) 👍


### Features

* Add Download Artifacts context button ([b06a1d9](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/b06a1d9fbf2cbc2eb93a541a756cf6c3cc8c316d))
  * Implemented by [Lennard Sprong](https://gitlab.com/X_Sheep) with [MR !625](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/625) 👍



## [3.48.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.48.0...v3.48.1) (2022-08-12)


### Bug Fixes

* downgrade VS Code for integration tests ([9b214c9](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/9b214c905538493539ae2ad955d3e78e245564f1))
* handle ssh urls with custom ports ([310dcc8](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/310dcc8ff687695fae11160e69b1407981dc14b0))
  * Implemented by [Adam Groves](https://gitlab.com/addywaddy) with [MR !616](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/616) 👍
* hotfix for vulnerabilities not conforming to the RestIssuable ([c728e10](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/c728e10492b37a2d7e573efbb4c9768cab1b7b35))



# [3.48.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.47.2...v3.48.0) (2022-07-28)


### Features

* Add Yaml file suggestion message ([b813d7e](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/b813d7eda7f8a38b0a75c6888567e31560dbd66f))
  * Thanks to [Tuna Ozkoc](https://gitlab.com/TunaOzk) for initial implementation [MR !466](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/466)
* minimal version check ([ff0c05b](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/ff0c05b8a74a74acb8e6c8437c9e9f90294b3135))



## [3.47.2](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.47.1...v3.47.2) (2022-06-22)


### Bug Fixes

* don't fetch closing issue if it's missing iid ([5e846c3](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/5e846c3a23fc64bec7a5e53c914edc9fe60d26f0))



## [3.47.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.47.0...v3.47.1) (2022-06-09)


### Bug Fixes

* indicate that extension is waiting for OAuth redirect ([32e1cd7](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/32e1cd78abf936185c1ee0dc3fa2109da54badd9))



# [3.47.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.46.0...v3.47.0) (2022-06-08)


### Features

* OAuth authorization welcome screen ([e1f1f6a](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/e1f1f6a15c7c63edd8c363ceb8b0f1eaf811bf1f))



# [3.46.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.45.0...v3.46.0) (2022-06-06)


### Bug Fixes

* update extension description to official ([9d0f314](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/9d0f314a045bc8023b4fd52d89f47c976a4e7a5b))


### Features

* update extension banner color ([6d068b1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/6d068b1a4ea95068006684b66e00c1bf797fe940))



# [3.45.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.44.2...v3.45.0) (2022-06-06)


### Bug Fixes

* improve UX for removing accounts where there is no account ([f0fef4d](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/f0fef4dba615a232dd60ac278dd8c98ea44c94f4))
* update extension icon ([fb5f20c](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/fb5f20c85b0e3ee6585b15560d673597e40b7bd4))
  * Implemented by [George Tsiolis](https://gitlab.com/gtsiolis) with [MR !570](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/570) 👍
* update extension marketplace icon ([0755ff6](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/0755ff6065721ff7524cffbc4404cbee0319d7d4))


### Features

* introduce debug mode ([2e0137f](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/2e0137f04e58a7028a53b7b2d5d2791718eb930a))
* OAuth authentication to GitLab.com ([e140b2d](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/e140b2d6d333454dfba562d88bf1b697079b89b8))
* rename "Set GitLab Personal Access Token" command to "Add Account" ([c94c5fe](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/c94c5fe7385161350156a5096867b772999943f2))



## [3.44.2](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.44.1...v3.44.2) (2022-05-25)


### Bug Fixes

* explain why creating a comment on a large diff fails ([d7a8c46](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/d7a8c463d37b10cb0db02a338d5ec63e58eca0db))
* warn user about OS Keychain issue on Ubuntu ([066d115](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/066d1153c3bf0e8cd8bcacc4f7d6659994a5b82b))



## [3.44.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.44.0...v3.44.1) (2022-05-13)


### Bug Fixes

* accounts can be removed even when they are missing token ([7fbf8d9](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/7fbf8d95a492eb5286f2e24c48676c1c4b485f93))
* remove tokens from secret storage when we remove account ([291e6da](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/291e6dad1b3a172f1a9196d6f2b8ebff5f66c8bb))



# [3.44.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.43.1...v3.44.0) (2022-05-13)

In this release we redesigned account management. Now it's possible to have multiple accounts (e.g. work and personal) on the same GitLab instance.

### Bug Fixes

* render markdown in MR comments ([9e249c7](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/9e249c7729cfd89150a4e493a0114d13b5bc2c2b))


### Features

* support multiple accounts on the same GitLab instance ([bb469bf](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/bb469bfdf51b92339d20f3c2331316ff1d69a46b))
* Updated code completion to include *.gitlab-ci.yml ([b8e3551](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/b8e3551efe8ca0be10934dcd99c2dea848671dbe))
  * Implemented by [Zack Knight](https://gitlab.com/zachkknowbe4) with [MR !549](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/549) 👍
* use VS Code SecretStorage to store tokens ([01cfc88](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/01cfc889ff8f4c22ccd40d631796066d3bd03e5c))



## [3.43.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.43.0...v3.43.1) (2022-05-03)


### Bug Fixes

* avoid "GitExtensionWrapper is missing repository" error ([537ed11](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/537ed11fd742ac9923b05fe4075848bd3ac956ca))



# [3.43.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.42.2...v3.43.0) (2022-05-03)

This release contains a [larger refactor of the extension internal state](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/558). This refactor closes 9 outstanding issues:

- [Detect GitLab instance from git remote](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/34)
- [Smarter multiple instances management](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/116)
- [Consistent handling of remotes, instances and branches](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/260)
- [Setting non-existing gitlab.remoteName causes git remote parsing error](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/394)
- [Assertion error if the local repository has a remote pointing to a local path](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/418)
- [Remote name will be used for every sub project](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/448)
- [Support instanceUrl at the workspace folder level](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/480)
- [not compatible with git remote using ssh config](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/537)
- [gitlab.repositories setting (used for preferred remote) can't handle relative path](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/546)

The following settings are no longer used:

- `gitlab.instanceUrl` - The extension automatically matches your GitLab token instance URL with the Git remote (based on host). If this matching fails, right-click the repository item in the GitLab Workflow TreeView and manually assign a GitLab repository.
- `gitlab.repositories.preferredRemote` - if you've got multiple GitLab projects for the same repository (e.g. fork and upstream), right-click the repository item in the GitLab Workflow TreeView and select which project should be used.

### Bug Fixes

* few minor issues with issuable search ([24253c1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/24253c140221b698a3d74e98e056871109215967))


### Features

* project-centric extension internal model ([d1c97a1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/d1c97a17f2ae262af375523ef11d273c5f05ab90))



## [3.42.2](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.42.1...v3.42.2) (2022-04-20)


### Bug Fixes

* can't access issue detail from closing issue ([5fdaffa](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/5fdaffa03cc90aecc409acc2c6357a56335a4b6d))
* MR /merge quick action ([b5d55b5](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/b5d55b5f180c67c5abe32dbe152a50e0f49188e5))



## [3.42.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.42.0...v3.42.1) (2022-04-12)


### Bug Fixes

* include response status and body in every fetch error ([c19a56e](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/c19a56e35bcc99584c941aa6996d3db6677d6cdd))
* support branches with hash symbol in their name ([58cfecc](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/58cfecc621222827fdf98f402f2d5a7b66b7778b))



# [3.42.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.41.2...v3.42.0) (2022-04-01)


### Features

* validate token right after user added it ([bcea7aa](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/bcea7aa734da5442dd151f9fe301bfea3b420d88))



## [3.41.2](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.41.1...v3.41.2) (2022-03-14)


### Bug Fixes

* getting MR discussions can only work on GitLab 13.9.0 or later ([79cad6a](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/79cad6af5d439ffc477bbe95c70a3f0df76a8ec7))



## [3.41.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.41.0...v3.41.1) (2022-03-09)


### Bug Fixes

* comment out Front Matter from README.md ([13bac39](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/13bac3934af389583de210639402fc64843d0a76))



# [3.41.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.40.2...v3.41.0) (2022-03-09)


### Features

* support <current_user> in more "user" filters ([e73d7d6](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/e73d7d6b2f020a5343308e293dbb88fd86183942))
  * Implemented by [Mathieu Rochette](https://gitlab.com/mathroc) with [MR !441](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/441) 👍
* validate GitLab instanceUrl setting ([d3e740f](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/d3e740f49d90a885f29f483d213db0924a31e442))
* validate instance URL for new token ([54ed3e1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/54ed3e1331044039676d2f0233392f5bf3f181a8))



## [3.40.2](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.40.1...v3.40.2) (2022-01-18)


### Bug Fixes

* fetch all pages from API ([d7da635](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/d7da63560fb8aac7db48161c6b7ec6934e0cf0f5))
* incorrect branch encoding ([9e394ec](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/9e394ec44c9069d540a6bec1af9c3c1794598e92))



## [3.40.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.40.0...v3.40.1) (2022-01-06)

- Improved README (https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/436, https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/434)
- Reduced extension size and startup time (https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/428)


# [3.40.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.39.0...v3.40.0) (2021-12-14)


### Bug Fixes

* manual job has unknown status in sidebar tree ([fd44ec9](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/fd44ec99295411cffd09a671536fceba130d4511))
  * Implemented by [@KevSlashNull](https://gitlab.com/KevSlashNull) with [MR !415](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/415) 👍


### Features

* render suggestions in MR reviews ([3178746](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/31787465c3e2659e4b56b3c80ddf46b69b8209b4))
* render suggestions in MR webview ([beeefcf](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/beeefcf1255df3ac5df854bcf2b9431919ce5c5e))



# [3.39.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.38.2...v3.39.0) (2021-12-07)


### Bug Fixes

* extension ignores expired token and fails in the wrong place ([4661365](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/4661365ada85c7b0af49fd5fb9ec205ff73498ea))
* show closing issue status bar item ([ef16e08](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/ef16e08b8f6bd5bd6b941902384c3363d6a4eb6d))


### Features

* introduce log level to logging ([c40ab03](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/c40ab038bc0b98e423b184ac74652010fac29d8a))
* open status bar MR link in webview ([56415fb](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/56415fb6502dcfe3a53f252e2329eb5361e0def9))
  * Implemented by [@KevSlashNull](https://gitlab.com/KevSlashNull) with [MR !416](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/416) 👍



## [3.38.2](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.38.1...v3.38.2) (2021-12-01)


### Bug Fixes

* remove pipeline ID from custom query parameters ([1fe2e96](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/1fe2e9685d72c2937e386ecf3db13bb49628bd6a))
* remove support for GitLab 10 and lower ([adef152](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/adef1525946ca5ad4f301c620ebecdc65a10f7ad))
* validating CI conig fails when there are multiple remtoes ([1bbac0d](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/1bbac0d0a34c034e91fbdcddd0e0ab9f7d07ca0d))



## [3.38.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.38.0...v3.38.1) (2021-11-22)


### Bug Fixes

* make Vue template rendering safer ([086dfbe](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/086dfbe24079b1b2aa80981b6daf2c6d2286263b))



# [3.38.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.37.0...v3.38.0) (2021-11-17)


### Bug Fixes

* rename Succeeded CI job status to Passed ([28c4864](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/28c4864b3c2ca7a221ba6f242714aa4d8a4c434b))
  * Implemented by [Justin Mai](https://gitlab.com/Justin.Mai) with [MR !361](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/361) 👍


### Performance Improvements

* reduce packaged extension size ([10334ac](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/10334ac57721431bc39dc07c9322f68b4ae9ee6f))
  * Big thanks to [Ethan Reesor](https://gitlab.com/firelizzard) who designed the original implementation in [Draft: Bundle with esbuild](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/334). He also helped with measuring performance and consulting the final implementation in [perf: reduce packaged extension size](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/368) 👍



# [3.37.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.36.1...v3.37.0) (2021-11-11)


### Features

* add 'view as tree' option ([#407](https://gitlab.com/gitlab-org/gitlab-vscode-extension/issues/407)) ([dc11640](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/dc116408dbe67759091ce2fc8c1a24af0bd5d81c))
  * Implemented by [Liming Jin](https://gitlab.com/jinliming2) with [MR !346](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/346) 👍



## [3.36.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.36.0...v3.36.1) (2021-11-08)

* no extension changes, only upgrading release tooling

# [3.36.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.35.0...v3.36.0) (2021-11-08)


### Bug Fixes

* retry loading failed project ([15bb715](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/15bb7156d2bd16e1ea4c4c0bff07e859b1592417))


### Features

* use GitLab credentials from environment variables ([9f22adc](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/9f22adc5dcd40f1317a92d2177d74242bfca8f95))



# [3.35.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.34.0...v3.35.0) (2021-11-02)


### Bug Fixes

* delayed job has unknown status in sidebar tree ([875a9c1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/875a9c1a83a35d1c3b13a56c20cba8ff686e6ea1))
  * Implemented by [@KevSlashNull](https://gitlab.com/KevSlashNull) with [MR !367](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/367) 👍
* images not working in MR/Issue comments ([16d03ff](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/16d03ff863c7962948c6bc534b743fa4748134e7))
* show user an error when project can't be found ([c6c7307](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/c6c7307c0eac9f22e8d84d96e71a0704bda95618))


### Features

* change tree view to list repositories first ([3e26dad](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/3e26dadf044a5ed9a85ebd4549a88981487c0c9c))



# [3.34.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.33.1...v3.34.0) (2021-10-26)


### Bug Fixes

* replace only fixed-size strings in rendered HTML ([c8f1116](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/c8f11166578c1fa6f3476fa6dbc97a0e85ae4eb0))


### Features

* support multiple remotes ([f45c3ac](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/f45c3acff78e74c70fcc981e7613e9e9e7694dce))



## [3.33.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.33.0...v3.33.1) (2021-10-19)


### Bug Fixes

* draft comments disappear after refresh ([b7553b8](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/b7553b8e6706f452265fc166c85eac6629a7c06e))



# [3.33.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.32.0...v3.33.0) (2021-10-08)


### Bug Fixes

* open repo on Windows ([83435cf](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/83435cf326815baa7c02acf46db65914360a7e29))
  * Implemented by [@firelizzard](https://gitlab.com/firelizzard) with [MR !354](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/354) 👍


### Features

* enable esModuleInterop ([ef702c7](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/ef702c7bcf9d811a7006af99ee7254f53e293e96))
  * Implemented by [@firelizzard](https://gitlab.com/firelizzard) with [MR !353](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/353) 👍
* refresh branch info when window gets focused or branch changed ([69096ce](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/69096ce702e02792504beb3b1d9111b8e1704e5c))



# [3.32.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.31.0...v3.32.0) (2021-10-06)


### Features

* add project/ref picker to open repo command ([5f84c2b](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/5f84c2bf7f229a16a3833c1806952d5b390fc5a8))
  * Implemented by [@firelizzard](https://gitlab.com/firelizzard) with [MR !338](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/338) 👍
* refresh MR only if it the refresh is user initiated ([428b28e](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/428b28e7779f928fa5d112a186be94df45b5f74f))
* refresh tree view and status bar together ([e5da54a](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/e5da54a6a922f703739315a2b2df1a8543c8febf))



# [3.31.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.30.0...v3.31.0) (2021-09-22)


### Bug Fixes

* **remote fs:** tell user when token is invalid ([25489c2](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/25489c2e7a9296a1ee906d0976cd002c0f0cd126))
  * Implemented by [@firelizzard](https://gitlab.com/firelizzard) with [MR !337](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/337) 👍


### Features

* disable ci validation and MR discussions for old GitLab versions ([1252c1b](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/1252c1bf5851b5c79286fe2188bff4a73835b3fd))
* remove the minimum version check and update readme ([0da2ba8](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/0da2ba81be56f8d987c9c53f76870cdc0e5ca2aa))
* use GraphQL to get snippet content ([b2090ab](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/b2090ab4df3675418caba86cd550cb1eb61561d1))



# [3.30.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.29.1...v3.30.0) (2021-09-10)


### Features

* show markdown help for missing token ([e31aedd](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/e31aedd5225ed307eac95575c0a4c88f5053f160))
  * Implemented by [@firelizzard](https://gitlab.com/firelizzard) with [MR !333](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/333) 👍



## [3.29.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.29.0...v3.29.1) (2021-08-26)


### Bug Fixes

* enable extension for virtual workspaces ([aee6529](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/aee6529cfb46586ccb359a2d0d336de1f01b2ce6))



# [3.29.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.28.2...v3.29.0) (2021-08-26)


### Features

* remote repository filesystem provider ([4476be5](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/4476be5df94e6ce977480614a0938ee7aaad35cb))
  * Implemented by [@firelizzard](https://gitlab.com/firelizzard) with [MR !321](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/321) 👍



## [3.28.2](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.28.1...v3.28.2) (2021-08-18)


### Bug Fixes

* Merge request detail doesn't show for a large MR ([b0488d5](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/b0488d521144f68e1bac1c40108fd8f2149bbc16))
  * Implemented by [@PeterW-LWL](https://gitlab.com/PeterW-LWL) with [MR !329](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/329) 👍



## [3.28.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.28.0...v3.28.1) (2021-08-12)


### Bug Fixes

* ci stages not correctly sorted ([7b0c4fb](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/7b0c4fb8d7764a4f9bc51ee6ea73a18566df0a38))
* matching instance URL with token is too strict ([9be7eb4](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/9be7eb4566adfec9a07b3800dde48079b6f84c06))



# [3.28.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.27.1...v3.28.0) (2021-08-11)


### Bug Fixes

* **gitRemoteParser:** allow self hosted git remote with ssh on custom port ([23f73b6](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/23f73b63ddcbd0968111795f5c8d93df27986059))
  * Implemented by [@PeterW-LWL](https://gitlab.com/PeterW-LWL) with [MR !319](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/319) 👍


### Features

* open local file during MR review ([0e05d42](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/0e05d42e10c91e9f72607b419160b15d740ca4d2))



## [3.27.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.27.0...v3.27.1) (2021-08-02)


### Bug Fixes

* use namespace CI lint endpoint to handle includes ([b21d5ba](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/b21d5baac35356295596d8a87316d571a7fb6c7e))
* web URL for file contains backwards slashes on windows ([118fc32](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/118fc322555db4944466d6ce4321c463f6016712))



# [3.27.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.26.0...v3.27.0) (2021-07-28)


### Bug Fixes

* error 400 when on a branch with special chars ([2645e0e](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/2645e0e85cf5689f0fab6c5ac1fc12bd65289d08))
  * Implemented by [@KevSlashNull](https://gitlab.com/KevSlashNull) with [MR !218](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/218) 👍


### Features

* improve UX when extension fails to create new comment ([4b3acbf](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/4b3acbfb50e64c6884dd8ca8940838c41560ae07))
* show CI pipelines and jobs ([bba4609](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/bba46099b6bb8aeabe2f76fb448a2aaf117669d9))


### Community contributions 👑 (not user-facing)

* Implemented by [@KevSlashNull](https://gitlab.com/KevSlashNull)
  * [chore(ci variables): update the ci\_variables.json](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/317)
  * [ci: run check-ci-variables job only on default branch](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/318)

# [3.26.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.25.0...v3.26.0) (2021-07-13)


### Features

* apply snippet patch ([2cc8a54](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/2cc8a541665d1c9befa7ec0e9e5f24abcec7be00))

### Documentation

* **welcome:** Prefill token name and scopes on welcome screen ([4b9aa6c](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/commit/4b9aa6c58a9f84a4f998ff86bf492b0df09bd52f))
  * Implemented by [@espadav8](https://gitlab.com/espadav8) with [MR !305](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/305) 👍


# [3.25.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.24.0...v3.25.0) (2021-07-08)


### Bug Fixes

* api calls fail when instance is on custom path ([0b487a6](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/0b487a62b76d160a95703080a89aea94694d6e3d))
  * Implemented by [@malinke](https://gitlab.com/malinke) with [MR !303](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/303) 👍
* inserting snippets not working for newly created snippets ([efaf1b7](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/efaf1b74acf42a6ab80a5f2a1d96e46da34722a0))


### Features

* create snippet patch ([750bae4](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/750bae4b2b8616bdf424a96f248ee51439351a1a))
* **gitclone:** add wiki repo clone support for git clone command ([621c396](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/621c3968083a7626436bed5be83613c3a409d33f))
  * Implemented by [@tonka3000](https://gitlab.com/tonka3000) with [MR !292](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/292) 👍



# [3.24.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.23.3...v3.24.0) (2021-06-30)


### Features

* indicate which changed files have MR discussions ([47f244b](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/47f244bc2252b9faacc31d1007d4c1e1d65c0e9d))
* **view issues-and-mrs:** checkout local branch for merge request ([174a955](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/174a95575ca85e9db054c3ddfbf882c755cc309a))
  * Big thanks to [@Musisimaru](https://gitlab.com/Musisimaru) who designed the implementation in [MR !229](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/229) 👍



## [3.23.3](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.23.2...v3.23.3) (2021-06-22)


### Bug Fixes

* pipeline actions not working ([363ea1d](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/363ea1dfaffc71488ec4736d7577843bd96897fb))



## [3.23.2](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.23.1...v3.23.2) (2021-06-17)


### Bug Fixes

* minimum version check ([a937eb3](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/a937eb3221b9537dca763507a07d08dd1af9b0fc))
* prevent duplicate comments and comment controllers ([bf0773e](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/bf0773e78f9dd337d1acdcd2225d815bf61e75c6))



## [3.23.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.23.0...v3.23.1) (2021-06-16)


### Bug Fixes

* temporarily disable version warning ([3252b73](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/3252b739b31a89cbdac14998b20b12f0a2a678cc))



# [3.23.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.22.1...v3.23.0) (2021-06-16)


### Bug Fixes

* **readme:** correct link to PAT settings ([f86a61c](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/f86a61cbe18464fe13be3bc74ba533661850a2f4))
  * Implemented by [@Rexogamer](https://gitlab.com/Rexogamer) with [MR !278](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/278) 👍
* **welcome screen:** update link to personal access token settings ([e59b91d](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/e59b91dd237bd847b9dd1a38be40ab82ae2d2081))


### Features

* warn users about out of date GitLab version ([0337ad0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/0337ad0e5dd2ee04626748d5dbd871e2c41c089d))



## [3.22.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.22.0...v3.22.1) (2021-06-10)


### Bug Fixes

* each overview tab gets opened only once ([b4f7b1c](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/b4f7b1c51d9b085762c7382b1ba7e704bfdd87e6))
* limit commenting only to GitLab MRs ([40d2f11](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/40d2f111a9f20f9100535a9d625ae092c39f78cf))



# [3.22.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.21.0...v3.22.0) (2021-06-08)


### Bug Fixes

*  comment controller can be disposed regardless of API failures ([28d322c](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/28d322c6d693359e72a3089cd6b2932f5acb336f))
* validate CI command didn't show validation result ([21080d6](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/21080d6c447c25ccd1a5f36720f93ec9766e7d03))


### Features

* **editor:** extend autocomplete glob pattern ([aa41067](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/aa41067666df5119ea8cd70669a35d68b04b3d7d))
  * Implemented by [@IAmMoen](https://gitlab.com/IAmMoen) with [MR !270](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/270) 👍

# [3.21.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.20.1...v3.21.0) (2021-06-04)


### Bug Fixes

* remove the broken code related to creating user snippets ([bb2b8a0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/bb2b8a01af81ec66f6f6b76989e13020a119cab0))


### Features

* create new MR diff comments ([f4e6e86](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/f4e6e8692865e3a6b9207eb6c7d615fbbf6fa235))



## [3.20.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.20.0...v3.20.1) (2021-05-19)


### Bug Fixes

* generating file link on windows uses backslash ([78f44f2](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/78f44f238dc103e2565bb496011bb8da73afd2f2))



# [3.20.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.19.0...v3.20.0) (2021-05-06)


### Bug Fixes

* limit command availability ([f6b5607](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/f6b5607d5ee9435fb729b97e20b05404e7e4bba1))
* **status bar:** status bar items couldn't open MRs and issues ([f41977e](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/f41977ece56cb288f4310c09d267e59b36587875))
* doesn't react to enabling git extension after it was disabled ([a999cc4](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/a999cc4c6edaaeccb803dfb395f0f3f6e5f5f4aa))


### Features

* **side panel:** use git repositories to look for GitLab projects ([3ee0a69](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/3ee0a696d1eb6e9ddcc782bc81945fd7e1956049))
* **status bar:** use repositories instead of workspaces ([bb9fed9](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/bb9fed950bb48a5518164166bb3da2c36e6a6723))

### Community contributions 👑 (not user-facing)

* Implemented by [@tnir](https://gitlab.com/tnir)
    * [Replace node-sass with sass](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/240)
    * [ci(eslint): update eslint from 6.8.0 to 7.25.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/241)
    * [ci(eslint): update @typescript-eslint from 3.10.1 to 4.22.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/242)

# [3.19.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.18.0...v3.19.0) (2021-04-30)


### Bug Fixes

* stop falsely logging that git extension isn't working ([b6cd7e6](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/b6cd7e6415d9eeae37e633e0970bc7f908431727))


### Features

* add commenting ranges for new file versions in diff ([6c22d3a](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/6c22d3a74300fbea98ab31a5e73c337acfb38583))
* show welcome view when there is no git repository ([ce9af7e](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/ce9af7e59b0b11cfb9af79b82460c43c2f1dcb60))

### Community contributions 👑 (not user-facing)

* Implemented by [@KevSlashNull](https://gitlab.com/KevSlashNull)
    * [Fix CI variables update script compares order of items](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/230)
    * [refactor: reduce eslint warnings](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/217)
    * [docs: update outdated sign up link](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/237)
    * [chore: update CI variables](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/238)
    * [docs: add notice to enable fork repo mirroring](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/236)
* [ci: add junit reports](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/183) implemented by [@haasef](https://gitlab.com/haasef)

# [3.18.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.17.1...v3.18.0) (2021-04-14)


### Bug Fixes

* **status bar:** hide all status items when there is no GitLab project ([6a5537e](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/6a5537ee9ac61abdd9b39e5d0944c282244c339d)), closes [#71](https://gitlab.com/gitlab-org/gitlab-vscode-extension/issues/71)
* use project_id from the pipeline instead of the workspace project ([7b6f1ba](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/7b6f1babd097ad994f08aceda6380b8cd805bddd))
* when fetching pipeline jobs fails, only log error, no notification ([fb75deb](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/fb75debbfce0f4a3e1f598b7dae5d401287bbd10))


### Features

* add "Merge requests I'm reviewing" custom query ([740c37d](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/740c37dc2370331811d2f62ee53965cc1ef121e7))
* only poll for new status bar information in focused window ([105afe9](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/105afe9055377a579f99a162e9a8eb296c49838d))



## [3.17.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.17.0...v3.17.1) (2021-04-12)


### Bug Fixes

* ci variables links are broken ([040a881](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/040a881f0bd017db7147a164070ba4f681c9b1b4))
  * Implemented by [@KevSlashNull](https://gitlab.com/KevSlashNull) with [MR !215](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/215) 👍


# [3.17.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.16.0...v3.17.0) (2021-04-08)


### Features

* **mr review:** respond to an MR diff thread ([3182937](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/31829375987c55e1935d15d7a4b692365f4bc607))
* **mr review:** show change type for each changed file ([b9f5e12](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/b9f5e120b7200b163a8e03a2490a60afe78058f0))



# [3.16.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.15.1...v3.16.0) (2021-04-07)


### Bug Fixes

* **instanceurl:** subpath in self-managed GitLab is not used [#319](https://gitlab.com/gitlab-org/gitlab-vscode-extension/issues/319) ([7b0cba0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/7b0cba0358a31e61776acc55aef08e75b418c7c5))
  * Implemented by [@amohoban](https://gitlab.com/amohoban) with [MR !206](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/206) 👍
* elliptic and y18n have vulnerabilities ([ba067e1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/ba067e1b73b8a065a5fd82d9aa54303bebe14d9b))
  * Implemented by [@KevSlashNull](https://gitlab.com/KevSlashNull) with [MR !214](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/214) 👍


### Features

* rename 'Description' to 'Overview' in MR items ([ca1ad6e](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/ca1ad6e0fc4b606b90f150a370d1a3b8dee5c42c))
  * Implemented by [@KevSlashNull](https://gitlab.com/KevSlashNull) with [MR !219](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/219) 👍
* **sidebar:** show welcome view if there are no tokens set ([a0fbaee](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/a0fbaee10780002f34dfe40200bd690fd02433a5))



## [3.15.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.15.0...v3.15.1) (2021-03-30)


### Security

* [CVE-2021-22195](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2021-22195) use the same git binary as VS Code ([0fe4c5f](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/0fe4c5fbcc947dee938635ca2a92a7d2deb6549b))



# [3.15.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.14.2...v3.15.0) (2021-03-17)


### Features

* **mr review:** editing comments on MR diffs ([fb7275a](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/fb7275a22eaf6dc71d2c30726b0f755a204b9586))



## [3.14.2](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.14.1...v3.14.2) (2021-03-15)

* no additional features or fixes, we only fixed the release pipeline ([MR !202](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/202))

## [3.14.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.14.0...v3.14.1) (2021-03-11)


### Bug Fixes

* workspace in project subfolder breaks Open active file on GitLab ([78372e8](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/78372e8b0e78bff8ee3450496452aeeb9592644a))
  * Implemented by [@GrantASL19](https://gitlab.com/GrantASL19) with [MR !185](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/185) 👍



# [3.14.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.13.0...v3.14.0) (2021-03-08)


### Features

* **git:** implement git clone command ([eeedd25](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/eeedd25bffae50e5f60151753cfbcf5b95a50d84)), closes [#222](https://gitlab.com/gitlab-org/gitlab-vscode-extension/issues/222)
  * Implemented by [@haasef](https://gitlab.com/haasef) with [MR !172](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/172) 👍
* **mr review:** deleting comments on MR diff ([d1d7446](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/d1d744624080dea35d6a5d61b28239aafb67747a))
* **mr review:** display whether discussion is resolved or not ([89da179](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/89da17934ebeb560bf494b35c297a9cccc65a260))
* **mr review:** resolving and unresolving discussions ([c7edee6](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/c7edee63f30d5d3ac1b637990ba5c0fcb6f61558))



# [3.13.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.12.1...v3.13.0) (2021-02-19)


### Features

* support detached pipelines ([4da4cba](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/4da4cba24f9e8602b35def50041dd39eeb88cca2))


### Performance Improvements

* **pipeline status:** remove unnecessary API call for single pipeline ([0c55ab4](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/0c55ab427740d67e1a4987b26e791f495e01939b))



## [3.12.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.12.0...v3.12.1) (2021-02-15)


### Bug Fixes

* support displaying users without avatars ([8e42065](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/8e42065f135a02d2ced13be27d6a0bc730deafb0))



# [3.12.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.11.2...v3.12.0) (2021-02-10)


### Bug Fixes

* **side tree:** for current branch not working for multiroot projects ([4c5989a](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/4c5989a20a80513673b90116f6591f040bb25138))
* **sidebar:** log error when fetching items ([2f95666](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/2f956665301cbb5cc98663245afcb31c79f3559d))


### Features

* try to get MR diff conent from local git before fetching from API ([b3c5f54](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/b3c5f541e2cfd52277c500b27e915b1507279d96))



## [3.11.2](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.11.1...v3.11.2) (2021-01-29)


### Bug Fixes

* **gitlab-service:** do not fail if project could not be found ([a5a4211](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/a5a421141e960e299167dad14587551e11f7f504))
  * Implemented by [@vymarkov](https://gitlab.com/vymarkov) with [MR !130](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/130) 👍
* some self-managed GitLab deployments not handling project URLs ([5c4e613](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/5c4e61388a5701d1e7faadc62ca5c6a13b7b0e7e))
* **gitlab_service:** include request URL when logging error ([9d0c8be](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/9d0c8be3dcf04d08891ad9b8f900e45cf2716722))
* **instance_url:** heuristic now supports git remote URLs ([56dab86](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/56dab86117c109443a9422b85b58605fa5b774f1))



## [3.11.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.11.0...v3.11.1) (2021-01-25)


### Bug Fixes

* **publishing:** readme file has to contain absolute URLs ([2580ba3](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/2580ba3387ff318483a626dc07633be66efd54aa))



# [3.11.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.10.0...v3.11.0) (2021-01-25)


### Bug Fixes

* **network:** new API logic supports custom certificates ([58c26f2](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/58c26f20eabf15c6a7b74845d9e791be01b57c46))
* **webview:** issue/mr details not showing for VS Code 1.53.0 (insiders) ([35d6ecd](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/35d6ecd1f5549364fd5376196f922d67026f3bfb))


### Features

* **editor:** auto completion for CI variables ([5c37266](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/5c37266f5bb3e21c3ae596fd7411973b4575986a))
  * Implemented by [@KevSlashNull](https://gitlab.com/KevSlashNull) with [MR !140](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/140) 👍



# [3.10.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.9.0...v3.10.0) (2021-01-19)


### Bug Fixes

* **mr review:** don't query position for webview discussions ([adc7706](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/adc7706d99c7ae471b939765ae4609b0d2846c72))
* avatars uploaded to GitLab don't show correctly ([6b51e4c](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/6b51e4cab0f6444d30561b0118238356608684be))


### Features

* **mr review:** show comments on changed file diff ([cba961a](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/cba961a8953adc1eec2c24c38144e96267aedb7f))



# [3.9.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.8.0...v3.9.0) (2021-01-12)


### Bug Fixes

* **webview:** can't respond in comment thread in webview for MR/Issue ([32c38f5](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/32c38f58c471fea2aafce55777bdfc29d4c980a2))
* **webview:** cosmetic fix of label note component ([7ce85cb](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/7ce85cba466ada35c1adb547296b5aeb4ef29fdc))
* **webview:** highlighting labels (including scoped) ([b30a7fd](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/b30a7fd3fdfd828a8a029c8fa61211d8a5a317b0))


### Features

* **statusbar:** create merge request when none exist for current branch ([33822ff](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/33822ff2a2a23d22a446d2fff3856fa1943aa47a)), closes [#291](https://gitlab.com/gitlab-org/gitlab-vscode-extension/issues/291)
  * Implemented by [@jotoho](https://gitlab.com/jotoho) with [MR !155](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/155) 👍


### Performance Improvements

* **webview:** use GraphQL to load MR/Issue discussions ([bdcd20f](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/bdcd20fdb652f20a1eebffcdc001256860ac485f))
* reduce packaged extension size ([8d616d2](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/8d616d2be2e010d98f6992fdc62c942e458e7307))
* replace moment with dayjs dependency ([4df1b48](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/4df1b4838f1cb5608771ac1978cdb484daa4a7e5))
  * Implemented by [@KevSlashNull](https://gitlab.com/KevSlashNull) with [MR !141](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/141) 👍



# [3.8.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.7.0...v3.8.0) (2020-12-16)


### Bug Fixes

* **mr review:** showing MR Diff on Windows uses correct file path ([0dcd5e0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/0dcd5e0aa749f1d1e4e5b6ee14b08c867bfa9d03))
  * Implemented by [@Codekrafter](https://gitlab.com/Codekrafter) with [MR !144](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/144) 👍
* label notes disappear after submitting a comment ([89b1fee](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/89b1fee3f3e14e991d72d6f7805da1de876290a5))
  * Implemented by [@KevSlashNull](https://gitlab.com/KevSlashNull) with [MR !137](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/137) 👍


### Features

* **sidebar:** add avatar to merge request item ([126b4c9](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/126b4c93fb0113d0d6e2dbec047c2cf5c06aa9db))
  * Implemented by [@KevSlashNull](https://gitlab.com/KevSlashNull) with [MR !142](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/142) 👍
* **webview:** allow submitting comments with ctrl+enter ([fb93040](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/fb93040aad8e07000942a1ff4c9d8f680e8e02cc))
  * Implemented by [@KevSlashNull](https://gitlab.com/KevSlashNull) with [MR !138](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/138) 👍



# [3.7.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.6.2...v3.7.0) (2020-12-08)


### Bug Fixes

* handle disabled pipelines or MRs ([125af41](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/125af415403cdee697a6ecb19cd4a51f0feecdee))


### Features

* remove experimental features feature flag ([1370d8b](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/1370d8bb115fecb9ae6585bf84e91b1c21308309))
* **mr review:** show changed file diff (API-provided) ([1c82018](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/1c82018f8c3d6bc2d05dd404e52ec6379ea18415))
* show changed files for the MR ([a2b3f88](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/a2b3f881f8de9c30bce5e423b51506a9935d6188))



## [3.6.2](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.6.1...v3.6.2) (2020-11-27)


### Bug Fixes

* custom queries don't work with scoped labels ([d9659c6](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/d9659c6bc1213a41fa0dc6aee8ccb9f07a98c171))



## [3.6.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.6.0...v3.6.1) (2020-11-26)


### Bug Fixes

* don't double send message from issue detail ([b7e1ee3](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/b7e1ee30dd917efafae1118e21c7f68d089988ab))
* parse remotes with trailing slash ([12e091b](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/12e091b509ec6505ec0e7c41d3062e73a025dec6))



# [3.6.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.5.0...v3.6.0) (2020-10-26)


### Features

* enable experimental features by default ([eceebcd](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/eceebcda6fc018202481c0a16d863e04f627d7d7))
* include user-agent header in all API requests ([f4f7d48](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/f4f7d48e200c168f6c6e9bc0d462168950a8c945))



# [3.5.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.4.0...v3.5.0) (2020-10-21)


### Features

* insert project snippets into the text editor ([a03468d](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/a03468d9e525fa9c9835fa8466e48646b8369f18))
* warn user about deprecating custom certificate logic ([280275c](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/280275c628904938f29e5d25c74189907402c596))



# [3.4.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.3.0...v3.4.0) (2020-10-19)


### Bug Fixes

* select project dialog gets stuck in a perpetual loop ([194be06](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/194be064912813fb16a5d0f3e9a1ca3fa2d8a4d2))
* **statusbar:** empty brackets show after pipeline status ([4a18c4c](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/4a18c4c23bb8cdbd531a72c24a3b957ef8aaafb5))
  * Implemented by [@KevSlashNull](https://gitlab.com/KevSlashNull) with [MR !102](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/102) 👍
* update extension project links to gitlab-org namespace ([f83b0f6](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/f83b0f6513e75f9fddf0e513be18d12080c5eeb6))
  * Implemented by [@salmanmo](https://gitlab.com/salmanmo) with [MR !109](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/109) 👍


### Features

* add project advanced search options ([bea5d9d](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/bea5d9dd1e4564b1fde3d0bbcde6e4bf081f5c62))



# [3.3.0](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.2.1...v3.3.0) (2020-09-21)


### Features

* better error reporting for fetching project and current user ([facb0e5](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/facb0e5426548e5407f28fffdf439e989be86519))
* detect instanceUrl from git remotes and GitLab access tokens ([457ca51](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/457ca510f1bb22a010d068300b53ad317e501b18))
  * Implemented by [@flood4life](https://gitlab.com/flood4life) with [MR !90](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/90) 👍
* every exception gets logged ([e286314](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/e2863142a8a9c0868c9d5dd116983fdfd1eba877))
* side panel error reporting ([eff8d2f](https://gitlab.com/gitlab-org/gitlab-vscode-extension/commit/eff8d2f8b365d4ab87587bfb412e5d0bd561dd93))



## [3.2.1](https://gitlab.com/gitlab-org/gitlab-vscode-extension/compare/v3.2.0...v3.2.1) (2020-08-31)

- No user facing changes. Release fixes `README.md` images [#226](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/226)

# v3.2.0 - 2020-08-03

- Publish GitLab Workflow extension to Open VSX Registry [#205](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/205)

### Fixed

- Command to create a new issue is not working [#218](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/218)

# v3.1.0 - 2020-07-28

- Copy GitLab link for the active file to the clipboard [#209](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/209)
  - Implemented by [@vegerot](https://gitlab.com/vegerot) with [MR !74](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/74) 👍

## v3.0.4 - 2020-07-03

- Increased interval for polling pipelines and merge requests for a branch [#211](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/211)

## v3.0.3 - 2020-06-29

- No user-facing changes.
- Fixed automated releasing of the extension [#206](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/206)

# v3.0.0 - 2020-06-25

- Support multi root workspaces.
- Enable custom queries in GitLab panel.
- Improvements to the issue and merge request webview.
- Adds gitlab icon as webview tab icon.
- Improve remote URL parsing to support non standard Gitlab usernames.
- Update Extension Icon to match the new vscode-codicons.

### Fixed

- Click on merge request "for current branch" doesn't do anything
- Unable to create Snippets [#195](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/195)
  - Fixed by [@massimeddu](https://gitlab.com/massimeddu) with [MR !62](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/62) 👍

## v2.2.2 - 2020-06-19

- Fix dependency issues caused by publishing the extension using `yarn`

## v2.2.1 - 2020-06-19

### Security

- [CVE-2020-13279](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2020-13279) Prevent possible client side code execution, https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/170

# v2.2.0 - 2019-11-06

- [Experimental Feature](https://gitlab.com/fatihacet/gitlab-vscode-extension#experimental-features): View Merge Request details and comments in VSCode. Click a Merge Request link from the sidebar and VSCode will open a new tab to show the Merge Request details. You can also directly comment on the Merge Request.

## v2.1.1 - 2019-07-10

### Fixed

- Showing issue details and discussions in VSCode was not working properly. Extension was only showing loading screen.

# v2.1.0 - 2019-05-10

### Fixed

- Ensure that WebView is fully loaded before sending message
  - Fixed by [@Grafexy](https://gitlab.com/Grafexy) with [MR !39](https://gitlab.com/fatihacet/gitlab-vscode-extension/merge_requests/39) 👍
- Create public snippet when there is no GitLab project in open workspace
  - Fixed by [@ttilberg](https://gitlab.com/ttilberg) with [MR !38](https://gitlab.com/fatihacet/gitlab-vscode-extension/merge_requests/38) 👍

### Documentation updates

- [@renestalder](https://gitlab.com/renestalder) improved documentation for additional custom domain information with [MR !35](https://gitlab.com/fatihacet/gitlab-vscode-extension/merge_requests/35) 👍
- [@jparkrr](https://gitlab.com/jparkrr) fixed some typos with [MR !36](https://gitlab.com/fatihacet/gitlab-vscode-extension/merge_requests/36) 👍

# v2.0.0 - 2019-02-14

- [Experimental Feature](https://gitlab.com/fatihacet/gitlab-vscode-extension#experimental-features): View issue details and comments right in the VSCode. Click an issue link from the sidebar and VSCode will open a new tab to show the issue details. You can also comment to the issue from VSCode.

## v1.9.3 - 2019-02-05

### Fixed

- Fix broken v1.9.2 by including require package
  - Fixed by [@swiffer](https://gitlab.com/swiffer) with [MR !33](https://gitlab.com/fatihacet/gitlab-vscode-extension/merge_requests/33) 👍

## v1.9.2 - 2019-02-05 (Please skip this version and upgrade to v1.9.3)

### Fixed

- Node 8.5/8.6 request bug, moved vscode to devDependencies and upgraded npm packages
  - Fixed by [@swiffer](https://gitlab.com/swiffer) with [MR !32](https://gitlab.com/fatihacet/gitlab-vscode-extension/merge_requests/32) 👍

### Changed

- [#85](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/85) Print URLs in "No token found" warning
  - This was done for troubleshooting purposes. A lot of people are having hard time to configure the instance url and hopefully this will give them a clue to understand what's going wrong.

## v1.9.1 - 2019-01-18

### Fixed

- [#28](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/28) Creating a snippet doesn't work when only 2 lines selected
  - Fixed by by [@joshanne](https://gitlab.com/joshanne) with [MR !30](https://gitlab.com/fatihacet/gitlab-vscode-extension/merge_requests/30) 👍

# v1.9.0 - 2019-01-17

### Added

- Support for crt/key pair certificates for users that may use a \*.p12 certificate
  - Implemented by [@joshanne](https://gitlab.com/joshanne) with [MR !29](https://gitlab.com/fatihacet/gitlab-vscode-extension/merge_requests/29) 👍

# v1.8.0 - 2019-01-02

### Added

- A new panel in the GitLab sidebar to show all MRs in the current project
  - Implemented by [@jkdufair](https://gitlab.com/jkdufair) with [MR !27](https://gitlab.com/fatihacet/gitlab-vscode-extension/merge_requests/27) 👍

# v1.7.0 - 2018-12-13

### Added

- Ability to work with the non-root domains for self hosted GitLab instances.
  - Implemented by [@tuomoa](https://gitlab.com/tuomoa) with [MR !11](https://gitlab.com/fatihacet/gitlab-vscode-extension/merge_requests/11) 👍
  - Special thanks to [@Turmio](https://gitlab.com/Turmio) for helping to test this. 👍

# v1.6.0 - 2018-12-12

### Security

- Fixed NPM security issues

### Added

- Pipeline notification on the status bar will now include the list of running and failed jobs
  - Implemented by [@jduponchelle](https://gitlab.com/jduponchelle) with [MR !23](https://gitlab.com/fatihacet/gitlab-vscode-extension/merge_requests/23) 👍

### Fixed

- Refresh buttons on the sidebar were visible for all panes and even for other extensions.
  - Fixed by [@Logerfo](https://gitlab.com/Logerfo) with [MR !26](https://gitlab.com/fatihacet/gitlab-vscode-extension/merge_requests/26) 👍

## v1.5.1 - 2018-11-28

### Fixed

- View in GitLab button in the pipeline updated notification was not visible
  - Fixed by [@Clapfire](https://gitlab.com/Clapfire) with [MR !24](https://gitlab.com/fatihacet/gitlab-vscode-extension/merge_requests/24) 👍

# v1.5.0 - 2018-11-08

### Added

- A new config option to fetch pipeline data from a different Git remote [Read more](https://gitlab.com/fatihacet/gitlab-vscode-extension#configuration-options)
  - Implemented by [@jduponchelle](https://gitlab.com/jduponchelle) with [MR !22](https://gitlab.com/fatihacet/gitlab-vscode-extension/merge_requests/22) and closes [Issue #59](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/59) 👍

# v1.4.0 - 2018-11-06

### Added

- A new config option to toggle pipeline status change notifications [Read more](https://gitlab.com/fatihacet/gitlab-vscode-extension#configuration-options)

### Changed

- Pipeline notifications introduced in v1.3.0 will not be on by default with this version. You need to manually set the option to true.

# v1.3.0 - 2018-11-05

### Added

- A new config option to set remote name manually [Read more](https://gitlab.com/fatihacet/gitlab-vscode-extension#configuration-options)
  - Implemented by [@jduponchelle](https://gitlab.com/jduponchelle) with [MR !18](https://gitlab.com/fatihacet/gitlab-vscode-extension/merge_requests/18) 👍
- Extension will show a notification after pipeline status changed
  - Implemented by [@Clapfire](https://gitlab.com/Clapfire) with [MR !21](https://gitlab.com/fatihacet/gitlab-vscode-extension/merge_requests/21) and closes [Issue #32](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/32) 👍

### Changed

- Pipeline action will not open the pipeline on the default browser
  - Changed by [@Clapfire](https://gitlab.com/Clapfire) with [MR !20](https://gitlab.com/fatihacet/gitlab-vscode-extension/merge_requests/20) and closes [#31](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/31) 👍

# v1.2.0 - 2018-10-03

### Added

- A new config option to toggle MR status on status bar [Read more](https://gitlab.com/fatihacet/gitlab-vscode-extension#configuration-options)
  - Implemented by [@robinvoor](https://gitlab.com/robinvoor) with [MR !15](https://gitlab.com/fatihacet/gitlab-vscode-extension/merge_requests/15) 👍

## v1.1.1 - 2018-10-03

### Fixed

- Invalid date parsing for unfinished pipelines.

# v1.1.0 - 2018-10-02

### Added

- A new config option to toggle GitLab related links on the status bar [Read more](https://gitlab.com/fatihacet/gitlab-vscode-extension#configuration-options)
  - Implemented with [this commit](https://gitlab.com/fatihacet/gitlab-vscode-extension/commit/6318028f1d3959ee0f70d22bb31b68bcbc4a998c) closes [#58](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/58)

### Fixed

- [#57](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/57) Can't use extension with self-hosted gitlab - scope validity
  - Fixed with [this commit](https://gitlab.com/fatihacet/gitlab-vscode-extension/commit/cf2fafec91df042ada35609848f251b6ebb02aeb)

# v1.0.0 - 2018-09-26

### Added

- A new panel on the sidebar to see the list of your issues and MRs alongside with the links and informations for your current branch. [Read more](https://gitlab.com/fatihacet/gitlab-vscode-extension#sidebar)

### Fixed

- [#41](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/41) Extension not opening the pipeline from command pallete
  - Fixed with [this commit](https://gitlab.com/fatihacet/gitlab-vscode-extension/commit/080a8c609f57df19b093dcfd0ec44cf89e7f5790)
- Respect VSCode http.proxy settings
  - Implemented by [@martianboy](https://gitlab.com/martianboy) with [MR !13](https://gitlab.com/fatihacet/gitlab-vscode-extension/merge_requests/13) 👍

# v0.6.0 - 2018-03-02

### Added

- A new config option named `gitlab.ca` to set self signed certificates. [Read more](https://gitlab.com/fatihacet/gitlab-vscode-extension#configuration-options)
- A new config option named `gitlab.ignoreCertificateErrors` to ignore certificate errors while connecting and fetching data from GitLab instance. [Read more](https://gitlab.com/fatihacet/gitlab-vscode-extension#configuration-options)

### Fixed

- [#26](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/26) Support for on-premises GitLab instances with self-signed
  - Fixed by [@piec](https://gitlab.com/piec) with [MR !8](https://gitlab.com/fatihacet/gitlab-vscode-extension/merge_requests/8) 👍
  - Possibily fixes [#23](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/23) and [#10](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/10)
- [#29](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/29) Support for on-premises GitLab instances with no certification (http)

## v0.5.2 - 2018-03-01

### Added

- GitLab Workflow now supports multiple instances.
  - Implemented by [@csvn](https://gitlab.com/csvn) with [MR !5](https://gitlab.com/fatihacet/gitlab-vscode-extension/merge_requests/5) 👍
- ESLint and Prettier integration for dev environment.
  - Added by [@alpcanaydin](https://gitlab.com/alpcanaydin) with [MR !6](https://gitlab.com/fatihacet/gitlab-vscode-extension/merge_requests/6) 👍

### Changed

- Private Access Token set and remove flow changed. We automatically migrate existing keys so this change shouldn't break your existing workflow or you shouln't need to do anyhing. Read more [here](https://gitlab.com/fatihacet/gitlab-vscode-extension#setup) and [here](https://gitlab.com/fatihacet/gitlab-vscode-extension#multiple-gitlab-instances).

## v0.5.1 - 2018-02-27

### Added

- Add an option to turn off the issue link in the status bar

# v0.5.0 - 2018-02-25

### Added

- [#25](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/25) Create snippet from selection or entire file.
- [#22](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/22) Add support for .gitlab-ci.yml lint-ing
- [#20](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/20) Added Read more and Set token now buttons to token ask notification.

## v0.4.3 - 2018-02-19

### Fixed

- [#19](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/19) Can't add token

## v0.4.2 - 2018-02-18

### Added

- 🎉 [New logo](https://gitlab.com/fatihacet/gitlab-vscode-extension/raw/main/src/assets/logo.png) _Special thanks to [@ademilter](https://twitter.com/ademilter) for his amazing work_ 👍

### Fixed

- [#14](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/14) GitLab: Open active file on GitLab - workspace path not filtered out
  - Fixed by [@swiffer](https://gitlab.com/swiffer) with [MR !1](https://gitlab.com/fatihacet/gitlab-vscode-extension/merge_requests/1) 👍
- [#16](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/16) Does not work witch projects in subgroup
  - Fixed by [@AmandaCameron](https://gitlab.com/AmandaCameron) with [MR !3](https://gitlab.com/fatihacet/gitlab-vscode-extension/merge_requests/3) 👍

## v0.4.1 - 2018-02-10

### Fixed

- [#17](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/17) Cross project closing issue goes to wrong URL.

# v0.4.0 - 2018-02-02

### Added

- Added search feature for MRs and Issues. Supports basic and advanced search.
  - For basic search, just type anything and hit Enter. Extension will search in title and description fields of MRs and issues.
  - For advanced search, you can use multiple tokens to search issues and MRs where tokens can be `title`, `author`, `assignee`, `labels`, `label`, `milestone`, `state`, `scope`. Some example usages:
    - discussions refactor
    - title: discussions refactor author: fatihacet labels: frontend, performance milestone: 10.5
    - title: group labels author: annabeldunstone assignee: timzallmann label: frontend
- Added closing issue link of current MR to status bar and clicking it will open related issue on GitLab.
- Added compare current branch with master feature.
- Added MIT License

### Changed

- Pipeline not found text on status bar will be hidden if there is no GL project.
- Significantly reduced timing of opening current MR from status bar.

## v0.3.4 - 2018-02-01

### Fixed

- [#12](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/12) Fix fetching git remote and tracking branch names.

## v0.3.3 - 2018-02-01

### Fixed

- Fixed slient failing of status bar items and hide them on error.

## v0.3.2 - 2018-01-31

### Fixed

- Fixed fetching remote url. Thanks to @kushalpandya.

## v0.3.1 - 2018-01-30

### Changed

- Clicking the pipeline status text on status bar now opens Pipeline action picker.

# v0.3.0 - 2018-01-30

### Added

- Pipeline actions picker
  - View latest pipeline on GitLab.com
  - Create a new pipeline for your current branch
  - Retry last pipeline
  - Cancel last pipeline

## v0.2.2 - 2018-01-29

### Added

- Added a new command to open current pipeline on GitLab.
- Added click handler to pipeline status text on status bar to open pipeline on GitLab.
- Added refresh interval for MR link on status bar.

### Fixed

- [#9](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/9) Branch names with slashes appear to break URL generation

## v0.2.1 - 2018-01-28

### Fixed

- Update pipeline status on status bar.

# v0.2.0 - 2018-01-27

### Added

- Added a new service layer to opearate git commands.
- Added a new service layer to talk with GitLab API.
- Added new methods to get info from Git and GitLab.
- Added Personal Access Token flow providing menu options to save and delete GitLab PAT.
- Implemented MR link on status bar and add click handler to open MR on GitLab.
- Implemented pipeline status on status bar.
- Implemented open active file on GitLab including active line number and selection.
- Implemented open current MR on GitLab.
- Implemented open GitLab to create new merge request.
- Implemented open GitLab to create new issue.

### Changed

- Deprecated `gitlab.userId`.
- Show assigned Issues and MRs now work project specific.

### Fixed

- [#7](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/7) Remove hardcoded origin in fetchGitRemote method.
- [#3](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/3) Assigned MR and issues openers should be project specific
- [#1](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/1) Local branch name and tracking remote branch name may not be the same
- [#8](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/8) API URL is hardcoded
- [#4](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/4) Remove pipes `|` from git commands
- [#5](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/5) Pipeline info won't be visible in status bar if there is no MR
- [#2](https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/4) Remove own MR requirement to find branch MR

## v0.1.1 - 2018-01-25

### Added

- Implemented show issues assigned to me.
- Implemented show merge requests assigned to me.
