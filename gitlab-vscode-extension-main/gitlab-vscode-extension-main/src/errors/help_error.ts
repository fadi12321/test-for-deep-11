import { HelpOptions } from '../utils/help';

export class HelpError extends Error {
  readonly options?: HelpOptions;

  constructor(message: string, options?: HelpOptions) {
    super(message);
    this.options = options;
  }

  static isHelpError(object: any): object is HelpError {
    return object instanceof HelpError;
  }
}
