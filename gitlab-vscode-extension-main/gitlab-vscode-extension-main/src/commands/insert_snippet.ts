import * as vscode from 'vscode';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { GqlBlob, GqlSnippet } from '../gitlab/graphql/get_snippets';
import { ProjectCommand } from './run_with_valid_project';

export const pickSnippet = async (snippets: GqlSnippet[]) => {
  const quickPickItems = snippets.map(s => ({
    label: s.title,
    description: s.description,
    detail: s.blobs.nodes.map(blob => blob.name).join(','),
    original: s,
  }));
  return vscode.window.showQuickPick(quickPickItems);
};

const pickBlob = async (blobs: GqlBlob[]) => {
  const quickPickItems = blobs.map(b => ({
    label: b.name,
    original: b,
  }));
  const result = await vscode.window.showQuickPick(quickPickItems);
  return result?.original;
};

export const insertSnippet: ProjectCommand = async projectInRepository => {
  if (!vscode.window.activeTextEditor) {
    await vscode.window.showInformationMessage('There is no open file.');
    return;
  }
  const snippets = await getGitLabService(projectInRepository).getSnippets(
    projectInRepository.project.namespaceWithPath,
  );
  if (snippets.length === 0) {
    await vscode.window.showInformationMessage('There are no project snippets.');
    return;
  }

  const result = await pickSnippet(snippets);
  if (!result) {
    return;
  }
  const blobs = result.original.blobs.nodes;
  const blob = blobs.length > 1 ? await pickBlob(blobs) : blobs[0];
  if (!blob) {
    return;
  }
  const snippet = await getGitLabService(projectInRepository).getSnippetContent(
    result.original,
    blob,
  );
  const editor = vscode.window.activeTextEditor;
  await editor.edit(editBuilder => {
    editBuilder.insert(editor.selection.start, snippet);
  });
};
