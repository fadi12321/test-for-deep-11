import * as vscode from 'vscode';
import { log } from '../../log';

export function getStopSequences(position: number, doc: vscode.TextDocument) {
  const stopSequences: string[] = [];

  // If the position is the last line, we don't use stop sequences
  if (doc.lineCount === position + 1) {
    return stopSequences;
  }
  // If the nextLine is not empty, it will be used as a stop sequence
  const nextLine = doc.lineAt(position + 1).text;
  if (nextLine) {
    stopSequences.push(nextLine.toString());
  }
  log.debug(`Stop sequences: ${stopSequences.toString()}`);
  return stopSequences;
}
