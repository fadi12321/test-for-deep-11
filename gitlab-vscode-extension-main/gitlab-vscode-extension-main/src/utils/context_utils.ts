import assert from 'assert';
import { ExtensionContext, Uri } from 'vscode';

class ContextUtils {
  private context: ExtensionContext | undefined;

  init(context: ExtensionContext) {
    this.context = context;
  }

  getEmbededFileUri(...path: string[]) {
    assert(this.context, 'Context Utils is not initialized');
    return Uri.joinPath(this.context.extensionUri, ...path);
  }
}

export const contextUtils = new ContextUtils();
