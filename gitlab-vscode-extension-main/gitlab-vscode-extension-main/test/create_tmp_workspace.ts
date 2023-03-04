import * as temp from 'temp';
import simpleGit from 'simple-git';
import * as path from 'path';
import * as fs from 'fs';
import { REMOTE, DEFAULT_VS_CODE_SETTINGS } from './integration/test_infrastructure/constants';

async function createTempFolder(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    temp.mkdir('vscodeWorkplace', (err: Error, dirPath: string) => {
      if (err) reject(err);
      resolve(dirPath);
    });
  });
}

async function addFile(folderPath: string, relativePath: string, content: string): Promise<void> {
  const fullPath = path.join(folderPath, relativePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  fs.writeFileSync(fullPath, content);
}

const isMac = () => Boolean(process.platform.match(/darwin/));

// `autoCleanUp = true` means that the directory gets deleted on process exit
export default async function createTmpWorkspace(autoCleanUp = true): Promise<string> {
  if (autoCleanUp) temp.track();
  const dirPath = await createTempFolder();
  const git = simpleGit(dirPath, { binary: 'git' });

  // the new version of git support set `init.defaultBranch` globally to customize the default branch name.
  // we need to pass `--initial-branch` option to restore the default branch name to `master`.
  // but the old version of git does not support this option, so we need to try-catch that.
  try {
    await git.init({ '--initial-branch': 'master' });
  } catch {
    await git.init();
  }

  await git.addRemote(REMOTE.NAME, REMOTE.URL);
  await git.addConfig('user.email', 'test@example.com');
  await git.addConfig('user.name', 'Test Name');
  await git.commit('Test commit', [], {
    '--allow-empty': null,
  });
  await addFile(dirPath, '/.vscode/settings.json', JSON.stringify(DEFAULT_VS_CODE_SETTINGS));
  // on mac, the temp node module creates folder in /var. /var is a symlink
  // to /private/var on mac. Every time we use git, it returns the non-symlinked /private prefixed path
  // https://apple.stackexchange.com/questions/1043/why-is-tmp-a-symlink-to-private-tmp/1096
  // this prefixing brings the git results in sync with the rest of the tests
  return isMac() ? `/private${dirPath}` : dirPath;
}
