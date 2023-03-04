import { USER_COMMANDS } from './command_names';
import * as packageJson from '../package.json';

describe('user commands', () => {
  it('should match exactly commands defined in package.json', () => {
    const packageJsonCommands = packageJson.contributes.commands.map(c => c.command);
    const constantCommands = Object.values(USER_COMMANDS);
    expect(packageJsonCommands.sort()).toEqual(constantCommands.sort());
  });
});
